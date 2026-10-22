import { databaseError, notFound } from "@/server/core/errors"
import type { SupabaseClient } from "@supabase/supabase-js"

type SupabaseLike = Pick<SupabaseClient, "from">

export interface AssessmentRecord {
  id: string
  patient_id: string
  nutritionist_id: string
  assessed_at: string
  weight_kg: number | null
  height_cm: number | null
  bmi: number | null
  body_fat_pct: number | null
  fat_mass_kg: number | null
  lean_mass_kg: number | null
  waist_cm: number | null
  hip_cm: number | null
  neck_cm: number | null
  chest_cm: number | null
  abdomen_cm: number | null
  thigh_cm: number | null
  triceps_mm: number | null
  subscapular_mm: number | null
  suprailiac_mm: number | null
  notes: string | null
  created_at: string
}

export interface MealItemPayload {
  food_name: string
  quantity: string
  unit: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  notes?: string | null
  sort_order: number
}

export interface MealPayload {
  name: string
  time_of_day?: string | null
  sort_order: number
  items: MealItemPayload[]
}

export interface DietPlanPayload {
  patient_id: string
  nutritionist_id: string
  title: string
  description?: string | null
  daily_kcal?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  notes?: string | null
  is_active?: boolean
}

export interface AppointmentPayload {
  patient_id: string
  nutritionist_id: string
  title: string
  scheduled_at: string
  duration_minutes: number
  status?: "scheduled" | "completed" | "cancelled" | "no_show"
  notes?: string | null
}

export async function createAssessmentRecord(
  supabase: SupabaseLike,
  payload: Omit<AssessmentRecord, "id" | "created_at">,
): Promise<void> {
  const { error } = await supabase.from("assessments").insert(payload)

  if (error) {
    throw databaseError("Unable to create assessment", error)
  }
}

export async function listAssessmentsByTenant(supabase: SupabaseLike, nutritionistId: string) {
  const { data, error } = await supabase
    .from("assessments")
    .select("*, patients(name, goal)")
    .eq("nutritionist_id", nutritionistId)
    .order("assessed_at", { ascending: false })

  if (error) {
    throw databaseError("Unable to list assessments", error)
  }

  return data ?? []
}

export async function listAssessmentsByPatient(
  supabase: SupabaseLike,
  nutritionistId: string,
  patientId: string,
): Promise<AssessmentRecord[]> {
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("nutritionist_id", nutritionistId)
    .eq("patient_id", patientId)
    .order("assessed_at", { ascending: false })

  if (error) {
    throw databaseError("Unable to list patient assessments", error)
  }

  return (data ?? []) as AssessmentRecord[]
}

export async function createDietPlanWithMeals(
  supabase: SupabaseLike,
  payload: DietPlanPayload,
  meals: MealPayload[],
): Promise<{ id: string }> {
  const { data: plan, error: planError } = await supabase
    .from("diet_plans")
    .insert(payload)
    .select("id")
    .single()

  if (planError || !plan) {
    throw databaseError("Unable to create diet plan", planError)
  }

  for (const meal of meals) {
    const { data: mealRow, error: mealError } = await supabase
      .from("meals")
      .insert({
        diet_plan_id: plan.id,
        name: meal.name,
        time_of_day: meal.time_of_day ?? null,
        sort_order: meal.sort_order,
      })
      .select("id")
      .single()

    if (mealError || !mealRow) {
      throw databaseError("Unable to create diet plan meal", mealError)
    }

    const itemsPayload = meal.items.map((item) => ({
      meal_id: mealRow.id,
      food_name: item.food_name,
      quantity: item.quantity,
      unit: item.unit,
      kcal: item.kcal,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      notes: item.notes ?? null,
      sort_order: item.sort_order,
    }))

    const { error: itemsError } = await supabase.from("meal_items").insert(itemsPayload)

    if (itemsError) {
      throw databaseError("Unable to create diet plan meal items", itemsError)
    }
  }

  return { id: plan.id }
}

export async function replaceDietPlanWithMeals(
  supabase: SupabaseLike,
  nutritionistId: string,
  planId: string,
  payload: Partial<DietPlanPayload>,
  meals: MealPayload[],
): Promise<void> {
  const { error: planError } = await supabase
    .from("diet_plans")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("nutritionist_id", nutritionistId)

  if (planError) {
    throw databaseError("Unable to update diet plan", planError)
  }

  const { data: existingMeals, error: mealsQueryError } = await supabase
    .from("meals")
    .select("id")
    .eq("diet_plan_id", planId)

  if (mealsQueryError) {
    throw databaseError("Unable to inspect existing meals", mealsQueryError)
  }

  const existingMealIds = (existingMeals ?? []).map((m: { id: string }) => m.id)
  if (existingMealIds.length > 0) {
    const { error: deleteItemsError } = await supabase.from("meal_items").delete().in("meal_id", existingMealIds)
    if (deleteItemsError) {
      throw databaseError("Unable to replace meal items", deleteItemsError)
    }

    const { error: deleteMealsError } = await supabase.from("meals").delete().eq("diet_plan_id", planId)
    if (deleteMealsError) {
      throw databaseError("Unable to replace meals", deleteMealsError)
    }
  }

  for (const meal of meals) {
    const { data: mealRow, error: mealError } = await supabase
      .from("meals")
      .insert({
        diet_plan_id: planId,
        name: meal.name,
        time_of_day: meal.time_of_day ?? null,
        sort_order: meal.sort_order,
      })
      .select("id")
      .single()

    if (mealError || !mealRow) {
      throw databaseError("Unable to create updated meals", mealError)
    }

    const itemsPayload = meal.items.map((item) => ({
      meal_id: mealRow.id,
      food_name: item.food_name,
      quantity: item.quantity,
      unit: item.unit,
      kcal: item.kcal,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      notes: item.notes ?? null,
      sort_order: item.sort_order,
    }))

    const { error: itemsError } = await supabase.from("meal_items").insert(itemsPayload)

    if (itemsError) {
      throw databaseError("Unable to create updated meal items", itemsError)
    }
  }
}

export async function getDietPlanById(
  supabase: SupabaseLike,
  nutritionistId: string,
  planId: string,
) {
  const { data, error } = await supabase
    .from("diet_plans")
    .select(`
      *,
      patients(id, name, email),
      meals (
        id, name, time_of_day, sort_order,
        meal_items (
          id, food_name, quantity, unit, kcal, protein_g, carbs_g, fat_g, notes, sort_order
        )
      )
    `)
    .eq("id", planId)
    .eq("nutritionist_id", nutritionistId)
    .order("sort_order", { referencedTable: "meals", ascending: true })
    .order("sort_order", { referencedTable: "meals.meal_items", ascending: true })
    .maybeSingle()

  if (error) {
    throw databaseError("Unable to load diet plan", error)
  }

  if (!data) {
    throw notFound("Diet plan not found")
  }

  return data
}

export async function listDietPlansByTenant(supabase: SupabaseLike, nutritionistId: string) {
  const { data, error } = await supabase
    .from("diet_plans")
    .select("*, patients(id, name)")
    .eq("nutritionist_id", nutritionistId)
    .order("updated_at", { ascending: false })

  if (error) {
    throw databaseError("Unable to list diet plans", error)
  }

  return data ?? []
}

export async function toggleDietPlanActiveState(
  supabase: SupabaseLike,
  nutritionistId: string,
  planId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("diet_plans")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("nutritionist_id", nutritionistId)

  if (error) {
    throw databaseError("Unable to update plan status", error)
  }
}

export async function deleteDietPlan(
  supabase: SupabaseLike,
  nutritionistId: string,
  planId: string,
): Promise<void> {
  const { error } = await supabase
    .from("diet_plans")
    .delete()
    .eq("id", planId)
    .eq("nutritionist_id", nutritionistId)

  if (error) {
    throw databaseError("Unable to delete diet plan", error)
  }
}

export async function listAppointmentsByTenant(supabase: SupabaseLike, nutritionistId: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select("*, patients(id, name)")
    .eq("nutritionist_id", nutritionistId)
    .order("scheduled_at", { ascending: true })

  if (error) {
    throw databaseError("Unable to list appointments", error)
  }

  return data ?? []
}

export async function createAppointmentRecord(
  supabase: SupabaseLike,
  payload: AppointmentPayload,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("appointments")
    .insert(payload)
    .select("id")
    .single()

  if (error || !data) {
    throw databaseError("Unable to create appointment", error)
  }

  return { id: data.id as string }
}

export async function createAiDraft(
  supabase: SupabaseLike,
  payload: {
    nutritionist_id: string
    patient_id?: string | null
    tool: string
    title: string
    latest_content: string
    metadata?: Record<string, unknown> | null
  },
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("ai_drafts")
    .insert(payload)
    .select("id")
    .single()

  if (error || !data) {
    throw databaseError("Unable to create AI draft", error)
  }

  return { id: data.id as string }
}

export async function updateAiDraft(
  supabase: SupabaseLike,
  nutritionistId: string,
  draftId: string,
  payload: {
    latest_content: string
    metadata?: Record<string, unknown> | null
  },
): Promise<void> {
  const { error } = await supabase
    .from("ai_drafts")
    .update({
      latest_content: payload.latest_content,
      metadata: payload.metadata ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .eq("nutritionist_id", nutritionistId)

  if (error) {
    throw databaseError("Unable to update AI draft", error)
  }
}

export async function findAiDraft(
  supabase: SupabaseLike,
  nutritionistId: string,
  patientId: string | null,
  tool: string,
): Promise<{ id: string } | null> {
  const query = supabase
    .from("ai_drafts")
    .select("id")
    .eq("nutritionist_id", nutritionistId)
    .eq("tool", tool)

  const { data, error } = patientId
    ? await query.eq("patient_id", patientId).maybeSingle()
    : await query.is("patient_id", null).maybeSingle()

  if (error) {
    throw databaseError("Unable to resolve AI draft", error)
  }

  if (!data) return null
  return { id: data.id as string }
}

export async function createAiDraftVersion(
  supabase: SupabaseLike,
  payload: {
    draft_id: string
    nutritionist_id: string
    tool: string
    prompt_context: string
    generated_content: string
    metadata?: Record<string, unknown> | null
  },
): Promise<void> {
  const { error } = await supabase.from("ai_draft_versions").insert(payload)

  if (error) {
    throw databaseError("Unable to create AI draft version", error)
  }
}

export async function getDashboardCounts(supabase: SupabaseLike, nutritionistId: string) {
  const [patientsRes, assessmentsRes, plansRes, appointmentsRes] = await Promise.all([
    supabase.from("patients").select("id, status, created_at").eq("nutritionist_id", nutritionistId),
    supabase.from("assessments").select("id, assessed_at").eq("nutritionist_id", nutritionistId),
    supabase.from("diet_plans").select("id, is_active, created_at").eq("nutritionist_id", nutritionistId),
    supabase.from("appointments").select("id, scheduled_at, status").eq("nutritionist_id", nutritionistId),
  ])

  const error = patientsRes.error ?? assessmentsRes.error ?? plansRes.error ?? appointmentsRes.error

  if (error) {
    throw databaseError("Unable to load dashboard metrics", error)
  }

  return {
    patients: patientsRes.data ?? [],
    assessments: assessmentsRes.data ?? [],
    plans: plansRes.data ?? [],
    appointments: appointmentsRes.data ?? [],
  }
}
