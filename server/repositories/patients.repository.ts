import { databaseError, notFound } from "@/server/core/errors"
import type { SupabaseClient } from "@supabase/supabase-js"

type SupabaseLike = Pick<SupabaseClient, "from">

export interface PatientRecord {
  id: string
  nutritionist_id: string
  name: string
  email: string | null
  phone: string | null
  dob: string | null
  sex: "male" | "female" | null
  height_cm: number | null
  goal: string | null
  activity_level: string | null
  status: "active" | "inactive" | "pending"
  allergies: string[] | null
  conditions: string[] | null
  medications: string | null
  supplements: string | null
  dietary_preferences: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  notes: string | null
  /** Conta de login do cliente que recebe os planos deste paciente */
  client_user_id?: string | null
  created_at: string
  updated_at: string
}

interface PatientDetailsRecord extends PatientRecord {
  assessments: Record<string, unknown>[]
  diet_plans: Record<string, unknown>[]
  patient_notes: Record<string, unknown>[]
  appointments: Record<string, unknown>[]
}

export async function listPatientsByTenant(supabase: SupabaseLike, nutritionistId: string): Promise<PatientRecord[]> {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("nutritionist_id", nutritionistId)
    .order("created_at", { ascending: false })

  if (error) {
    throw databaseError("Unable to list patients", error)
  }

  return (data ?? []) as PatientRecord[]
}

export async function getPatientById(
  supabase: SupabaseLike,
  nutritionistId: string,
  patientId: string,
): Promise<PatientRecord> {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("nutritionist_id", nutritionistId)
    .maybeSingle()

  if (error) {
    throw databaseError("Unable to load patient", error)
  }

  if (!data) {
    throw notFound("Patient not found")
  }

  return data as PatientRecord
}

export async function getPatientWithDetails(
  supabase: SupabaseLike,
  nutritionistId: string,
  patientId: string,
): Promise<
  PatientRecord & {
    assessments: Record<string, unknown>[]
    diet_plans: Record<string, unknown>[]
    patient_notes: Record<string, unknown>[]
    appointments: Record<string, unknown>[]
  }
> {
  const { data, error } = await supabase
    .from("patients")
    .select(`
      *,
      assessments (
        id, weight_kg, height_cm, bmi, body_fat_pct, fat_mass_kg, lean_mass_kg,
        waist_cm, hip_cm, neck_cm, chest_cm, abdomen_cm, thigh_cm,
        triceps_mm, subscapular_mm, suprailiac_mm, assessed_at, notes, created_at
      ),
      diet_plans (
        id, title, description, daily_kcal, protein_g, carbs_g, fat_g,
        notes, is_active, share_token, created_at, updated_at,
        meals (
          id, name, time_of_day, sort_order,
          meal_items (
            id, food_name, quantity, unit, kcal, protein_g, carbs_g, fat_g, notes, sort_order
          )
        )
      ),
      patient_notes (
        id, content, created_at, updated_at
      ),
      appointments (
        id, title, scheduled_at, duration_minutes, status, notes, created_at
      )
    `)
    .eq("id", patientId)
    .eq("nutritionist_id", nutritionistId)
    .order("assessed_at", { referencedTable: "assessments", ascending: false })
    .order("created_at", { referencedTable: "patient_notes", ascending: false })
    .order("scheduled_at", { referencedTable: "appointments", ascending: false })
    .order("sort_order", { referencedTable: "diet_plans.meals", ascending: true })
    .order("sort_order", { referencedTable: "diet_plans.meals.meal_items", ascending: true })
    .maybeSingle()

  if (error) {
    throw databaseError("Unable to load patient details", error)
  }

  if (!data) {
    throw notFound("Patient not found")
  }

  const details = data as unknown as PatientDetailsRecord

  return {
    ...details,
    assessments: details.assessments ?? [],
    diet_plans: details.diet_plans ?? [],
    patient_notes: details.patient_notes ?? [],
    appointments: details.appointments ?? [],
  }
}

export async function createPatientRecord(
  supabase: SupabaseLike,
  payload: Omit<PatientRecord, "id" | "created_at" | "updated_at">,
): Promise<PatientRecord> {
  const { data, error } = await supabase
    .from("patients")
    .insert(payload)
    .select("*")
    .single()

  if (error) {
    throw databaseError("Unable to create patient", error)
  }

  return data as PatientRecord
}

export async function updatePatientRecord(
  supabase: SupabaseLike,
  nutritionistId: string,
  patientId: string,
  payload: Partial<Omit<PatientRecord, "id" | "nutritionist_id" | "created_at">>,
): Promise<void> {
  const { error } = await supabase
    .from("patients")
    .update(payload)
    .eq("id", patientId)
    .eq("nutritionist_id", nutritionistId)

  if (error) {
    throw databaseError("Unable to update patient", error)
  }
}

export async function deletePatientRecord(
  supabase: SupabaseLike,
  nutritionistId: string,
  patientId: string,
): Promise<void> {
  const { error } = await supabase
    .from("patients")
    .delete()
    .eq("id", patientId)
    .eq("nutritionist_id", nutritionistId)

  if (error) {
    throw databaseError("Unable to delete patient", error)
  }
}

export async function insertPatientNote(
  supabase: SupabaseLike,
  payload: {
    patient_id: string
    nutritionist_id: string
    content: string
  },
): Promise<void> {
  const { error } = await supabase.from("patient_notes").insert(payload)

  if (error) {
    throw databaseError("Unable to create patient note", error)
  }
}
