"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { toActionError } from "@/server/core/errors"
import { fail, ok } from "@/server/core/result"
import { formDataToObject, parseWithSchema } from "@/server/core/validation"
import { z } from "zod"
import { getProfile } from "@/lib/actions/auth"

const linkSchema = z.object({
  patient_id: z.string().uuid(),
  client_email: z.string().trim().email(),
})

const publishSchema = z.object({
  diet_plan_id: z.string().uuid(),
})

/**
 * Liga o registo de paciente à conta de cliente (por email).
 * Cada paciente fica associado a um único cliente — planos chegam só a ele.
 */
export async function linkPatientToClient(formData: FormData) {
  try {
    const profile = await getProfile()
    if (!profile || (profile.role !== "nutritionist" && profile.role !== "super_admin")) {
      return fail({ code: "UNAUTHORIZED", message: "Sem permissão." })
    }

    const input = parseWithSchema(linkSchema, formDataToObject(formData))
    const supabase = await createClient()

    // Paciente pertence a este nutricionista
    const { data: patient, error: pErr } = await supabase
      .from("patients")
      .select("id, nutritionist_id, name, client_user_id")
      .eq("id", input.patient_id)
      .maybeSingle()

    if (pErr || !patient) {
      return fail({ code: "NOT_FOUND", message: "Paciente não encontrado." })
    }
    if (profile.role === "nutritionist" && patient.nutritionist_id !== profile.id) {
      return fail({ code: "UNAUTHORIZED", message: "Este paciente não é seu." })
    }

    // Conta de cliente com esse email
    const { data: clientProfile, error: cErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("email", input.client_email.toLowerCase())
      .eq("role", "client")
      .maybeSingle()

    if (cErr || !clientProfile) {
      return fail({
        code: "NOT_FOUND",
        message:
          "Não existe conta de cliente com este email. Peça ao cliente para se registar em /register ou crie a conta no Super Admin.",
      })
    }

    const { error: uErr } = await supabase
      .from("patients")
      .update({
        client_user_id: clientProfile.id,
        email: clientProfile.email || patient.name,
      })
      .eq("id", input.patient_id)

    if (uErr) {
      return fail({ code: "DATABASE_ERROR", message: uErr.message })
    }

    revalidatePath(`/dashboard/patients/${input.patient_id}`)
    revalidatePath("/dashboard/patients")
    revalidatePath("/cliente/planos")

    return ok({
      patient_id: input.patient_id,
      client_user_id: clientProfile.id,
      client_name: clientProfile.full_name,
      client_email: clientProfile.email,
    })
  } catch (error) {
    return fail(toActionError(error))
  }
}

/**
 * Verifica se este cliente já tem pagamento confirmado com este nutricionista
 * (ou consulta paga/aprovada).
 */
async function hasConfirmedPayment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientUserId: string,
  nutritionistId: string,
): Promise<boolean> {
  const { data: pay } = await supabase
    .from("payments")
    .select("id")
    .eq("client_user_id", clientUserId)
    .eq("nutritionist_id", nutritionistId)
    .eq("status", "confirmed")
    .limit(1)

  if (pay && pay.length > 0) return true

  const { data: consult } = await supabase
    .from("consultation_requests")
    .select("id")
    .eq("client_user_id", clientUserId)
    .eq("nutritionist_id", nutritionistId)
    .in("status", ["paid", "approved"])
    .limit(1)

  return !!(consult && consult.length > 0)
}

/**
 * Envia o plano ao cliente (fica visível em /cliente/planos).
 * Só é permitido se o paciente estiver ligado a uma conta E o pagamento estiver confirmado.
 */
export async function publishDietPlanToClient(formData: FormData) {
  try {
    const profile = await getProfile()
    if (!profile || (profile.role !== "nutritionist" && profile.role !== "super_admin")) {
      return fail({ code: "UNAUTHORIZED", message: "Sem permissão." })
    }

    const input = parseWithSchema(publishSchema, formDataToObject(formData))
    const supabase = await createClient()

    const { data: plan, error: planErr } = await supabase
      .from("diet_plans")
      .select("id, title, patient_id, nutritionist_id, published_to_client_at")
      .eq("id", input.diet_plan_id)
      .maybeSingle()

    if (planErr || !plan) {
      return fail({ code: "NOT_FOUND", message: "Plano não encontrado." })
    }
    if (profile.role === "nutritionist" && plan.nutritionist_id !== profile.id) {
      return fail({ code: "UNAUTHORIZED", message: "Este plano não é seu." })
    }
    if (!plan.patient_id) {
      return fail({
        code: "VALIDATION_ERROR",
        message: "O plano precisa de estar associado a um paciente antes de ser enviado.",
      })
    }

    const { data: patient, error: patErr } = await supabase
      .from("patients")
      .select("id, name, client_user_id, nutritionist_id")
      .eq("id", plan.patient_id)
      .maybeSingle()

    if (patErr || !patient) {
      return fail({ code: "NOT_FOUND", message: "Paciente do plano não encontrado." })
    }
    if (!patient.client_user_id) {
      return fail({
        code: "VALIDATION_ERROR",
        message:
          "Ligue primeiro o paciente a uma conta de cliente (email) na ficha do paciente. Só depois pode enviar o plano.",
      })
    }

    const paid = await hasConfirmedPayment(supabase, patient.client_user_id, plan.nutritionist_id)
    if (!paid && profile.role !== "super_admin") {
      return fail({
        code: "VALIDATION_ERROR",
        message:
          "Só pode enviar o plano depois de confirmar o pagamento deste cliente (área Pagamentos).",
      })
    }

    const { data: updated, error: upErr } = await supabase
      .from("diet_plans")
      .update({
        published_to_client_at: new Date().toISOString(),
        published_by: profile.id,
        is_active: true,
      })
      .eq("id", plan.id)
      .select()
      .single()

    if (upErr) {
      return fail({ code: "DATABASE_ERROR", message: upErr.message })
    }

    revalidatePath(`/dashboard/diet-plans/${plan.id}`)
    revalidatePath("/dashboard/diet-plans")
    revalidatePath(`/dashboard/patients/${patient.id}`)
    revalidatePath("/cliente/planos")
    revalidatePath("/cliente")

    return ok({
      plan_id: plan.id,
      title: plan.title,
      patient_name: patient.name,
      published_to_client_at: updated.published_to_client_at,
    })
  } catch (error) {
    return fail(toActionError(error))
  }
}

/** Remove a visibilidade do plano no portal do cliente (não apaga o plano). */
export async function unpublishDietPlan(formData: FormData) {
  try {
    const profile = await getProfile()
    if (!profile || (profile.role !== "nutritionist" && profile.role !== "super_admin")) {
      return fail({ code: "UNAUTHORIZED", message: "Sem permissão." })
    }

    const input = parseWithSchema(publishSchema, formDataToObject(formData))
    const supabase = await createClient()

    const { data: plan } = await supabase
      .from("diet_plans")
      .select("id, nutritionist_id, patient_id")
      .eq("id", input.diet_plan_id)
      .maybeSingle()

    if (!plan) return fail({ code: "NOT_FOUND", message: "Plano não encontrado." })
    if (profile.role === "nutritionist" && plan.nutritionist_id !== profile.id) {
      return fail({ code: "UNAUTHORIZED", message: "Este plano não é seu." })
    }

    await supabase
      .from("diet_plans")
      .update({ published_to_client_at: null, published_by: null })
      .eq("id", plan.id)

    revalidatePath(`/dashboard/diet-plans/${plan.id}`)
    revalidatePath("/cliente/planos")
    return ok({ plan_id: plan.id })
  } catch (error) {
    return fail(toActionError(error))
  }
}

export async function getPatientClientLink(patientId: string) {
  try {
    const profile = await getProfile()
    if (!profile) return fail({ code: "UNAUTHORIZED", message: "Não autenticado." })

    const supabase = await createClient()
    const { data: patient, error } = await supabase
      .from("patients")
      .select("id, name, email, client_user_id, nutritionist_id")
      .eq("id", patientId)
      .maybeSingle()

    if (error || !patient) {
      return fail({ code: "NOT_FOUND", message: "Paciente não encontrado." })
    }

    let client: { id: string; full_name: string | null; email: string | null } | null = null
    if (patient.client_user_id) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", patient.client_user_id)
        .maybeSingle()
      client = data
    }

    const paid = patient.client_user_id
      ? await hasConfirmedPayment(supabase, patient.client_user_id, patient.nutritionist_id)
      : false

    return ok({ patient, client, paymentConfirmed: paid })
  } catch (error) {
    return fail(toActionError(error))
  }
}
