"use server"

import { createClient } from "@/lib/supabase/server"
import { databaseError, unauthorized } from "@/server/core/errors"
import type { AppRole } from "@/server/core/auth"
import { withTimeout } from "@/lib/utils/with-timeout"

const DASHBOARD_QUERY_TIMEOUT_MS = 8000

function normalizeRole(value: unknown): AppRole {
  if (value === "nutritionist" || value === "assistant" || value === "admin") return value
  return "nutritionist"
}

export async function getDashboardData() {
  const supabase = await createClient()

  // Single auth call for the entire page
  const {
    data: { user },
    error: userError,
  } = await withTimeout(
    supabase.auth.getUser(),
    DASHBOARD_QUERY_TIMEOUT_MS,
    "Dashboard auth lookup",
  )

  if (userError) {
    throw databaseError("Unable to load authenticated user", userError)
  }

  if (!user) {
    throw unauthorized()
  }

  const userId = user.id

  // All data queries in a single parallel batch
  const [profileRes, patientsRes, assessmentsRes, plansRes, appointmentsRes] = await withTimeout(
    Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("patients").select("*").eq("nutritionist_id", userId).order("created_at", { ascending: false }),
      supabase.from("assessments").select("id, assessed_at").eq("nutritionist_id", userId),
      supabase.from("diet_plans").select("id, is_active, created_at").eq("nutritionist_id", userId),
      supabase.from("appointments").select("id, scheduled_at, status").eq("nutritionist_id", userId),
    ]),
    DASHBOARD_QUERY_TIMEOUT_MS,
    "Dashboard data query batch",
  )

  const error = profileRes.error ?? patientsRes.error ?? assessmentsRes.error ?? plansRes.error ?? appointmentsRes.error
  if (error) {
    throw databaseError("Unable to load dashboard data", error)
  }

  const profile = profileRes.data
  const patients = patientsRes.data ?? []
  const assessments = assessmentsRes.data ?? []
  const plans = plansRes.data ?? []
  const appointments = appointmentsRes.data ?? []

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const role = normalizeRole(profile?.role ?? user.user_metadata?.role)

  return {
    profile: profile ? { ...profile, role } : { full_name: null, email: user.email, role },
    patients,
    stats: {
      totalPatients: patients.length,
      activePatients: patients.filter((p: { status: string }) => p.status === "active").length,
      newPatientsThisMonth: patients.filter((p: { created_at: string }) => new Date(p.created_at) > thirtyDaysAgo).length,
      totalAssessments: assessments.length,
      assessmentsThisMonth: assessments.filter((a: { assessed_at: string }) => new Date(a.assessed_at) > thirtyDaysAgo).length,
      activeDietPlans: plans.filter((p: { is_active: boolean }) => p.is_active).length,
      upcomingAppointments: appointments.filter(
        (a: { status: string; scheduled_at: string }) => a.status === "scheduled" && new Date(a.scheduled_at) > now,
      ).length,
    },
  }
}
