"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { toActionError } from "@/server/core/errors"
import { fail, ok } from "@/server/core/result"
import { formDataToObject, parseWithSchema } from "@/server/core/validation"
import { z } from "zod"
import { getProfile } from "@/lib/actions/auth"

const createUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(["nutritionist", "client"]),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  clinic_name: z.string().trim().max(160).optional().or(z.literal("")),
  crn: z.string().trim().max(60).optional().or(z.literal("")),
  payment_phone: z.string().trim().max(40).optional().or(z.literal("")),
  payment_instructions: z.string().trim().max(1000).optional().or(z.literal("")),
})

const updateUserSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  clinic_name: z.string().trim().max(160).optional().or(z.literal("")),
  crn: z.string().trim().max(60).optional().or(z.literal("")),
  payment_phone: z.string().trim().max(40).optional().or(z.literal("")),
  payment_instructions: z.string().trim().max(1000).optional().or(z.literal("")),
  is_active: z.enum(["true", "false"]).optional(),
})

async function assertSuperAdmin() {
  const profile = await getProfile()
  if (!profile || profile.role !== "super_admin") {
    throw new Error("Acesso restrito ao Super Admin.")
  }
  return profile
}

export async function listAllUsers() {
  try {
    await assertSuperAdmin()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) return fail({ code: "DATABASE_ERROR", message: error.message })
    return ok(data ?? [])
  } catch (error) {
    return fail(toActionError(error))
  }
}

/**
 * Creates auth user + profile via service role.
 * Requires SUPABASE_SERVICE_ROLE_KEY in environment.
 */
export async function adminCreateUser(formData: FormData) {
  try {
    await assertSuperAdmin()
    const input = parseWithSchema(createUserSchema, formDataToObject(formData))

    const admin = createAdminClient()
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.full_name,
        role: input.role,
        clinic_name: input.clinic_name || null,
        crn: input.crn || null,
        phone: input.phone || null,
      },
    })

    if (authError || !authData.user) {
      return fail({
        code: "CONFLICT",
        message: authError?.message || "Falha ao criar utilizador.",
      })
    }

    const userId = authData.user.id

    // Ensure profile has correct role and payment fields
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      full_name: input.full_name,
      email: input.email,
      role: input.role,
      phone: input.phone || null,
      clinic_name: input.clinic_name || null,
      crn: input.crn || null,
      payment_phone: input.payment_phone || null,
      payment_instructions: input.payment_instructions || null,
      is_active: true,
    })

    if (profileError) {
      return fail({ code: "DATABASE_ERROR", message: profileError.message })
    }

    revalidatePath("/admin")
    return ok({ id: userId, email: input.email, role: input.role })
  } catch (error) {
    return fail(toActionError(error))
  }
}

export async function adminUpdateUser(formData: FormData) {
  try {
    await assertSuperAdmin()
    const input = parseWithSchema(updateUserSchema, formDataToObject(formData))
    const admin = createAdminClient()

    const patch: Record<string, unknown> = {}
    if (input.full_name !== undefined) patch.full_name = input.full_name
    if (input.phone !== undefined) patch.phone = input.phone || null
    if (input.clinic_name !== undefined) patch.clinic_name = input.clinic_name || null
    if (input.crn !== undefined) patch.crn = input.crn || null
    if (input.payment_phone !== undefined) patch.payment_phone = input.payment_phone || null
    if (input.payment_instructions !== undefined)
      patch.payment_instructions = input.payment_instructions || null
    if (input.is_active !== undefined) patch.is_active = input.is_active === "true"

    const { data, error } = await admin.from("profiles").update(patch).eq("id", input.id).select().single()

    if (error) return fail({ code: "DATABASE_ERROR", message: error.message })

    revalidatePath("/admin")
    return ok(data)
  } catch (error) {
    return fail(toActionError(error))
  }
}

export async function adminStats() {
  try {
    await assertSuperAdmin()
    const supabase = await createClient()

    const [nutritionists, clients, pendingConsults, payments] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "nutritionist"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client"),
      supabase
        .from("consultation_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "awaiting_payment"]),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    ])

    return ok({
      nutritionists: nutritionists.count ?? 0,
      clients: clients.count ?? 0,
      pendingConsultations: pendingConsults.count ?? 0,
      pendingPayments: payments.count ?? 0,
    })
  } catch (error) {
    return fail(toActionError(error))
  }
}
