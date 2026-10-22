import { createClient } from "@/lib/supabase/server"
import { databaseError, forbidden, unauthorized } from "@/server/core/errors"
import { withTimeout } from "@/lib/utils/with-timeout"

export type AppRole = "nutritionist" | "assistant" | "admin"

export interface ViewerContext {
  userId: string
  role: AppRole
  email: string | null
}

const DEFAULT_ROLE: AppRole = "nutritionist"
const AUTH_QUERY_TIMEOUT_MS = 8000

export async function requireViewer(): Promise<ViewerContext> {
  const supabase = await createClient()
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null
  let userError: Awaited<ReturnType<typeof supabase.auth.getUser>>["error"] = null

  try {
    const response = await withTimeout(
      supabase.auth.getUser(),
      AUTH_QUERY_TIMEOUT_MS,
      "Viewer auth lookup",
    )
    user = response.data.user
    userError = response.error
  } catch (error) {
    throw databaseError("Unable to load authenticated user", error)
  }

  if (userError) {
    throw databaseError("Unable to load authenticated user", userError)
  }

  if (!user) {
    throw unauthorized()
  }

  let profile: { role?: string } | null = null
  let profileError: unknown = null

  try {
    const response = await withTimeout(
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle(),
      AUTH_QUERY_TIMEOUT_MS,
      "Viewer profile lookup",
    )

    profile = response.data as { role?: string } | null
    profileError = response.error
  } catch (error) {
    throw databaseError("Unable to load user profile", error)
  }

  if (profileError) {
    throw databaseError("Unable to load user profile", profileError)
  }

  const metaRole = user.user_metadata?.role
  const profileRole = profile?.role
  const role = normalizeRole(profileRole ?? metaRole)

  return {
    userId: user.id,
    role,
    email: user.email ?? null,
  }
}

export async function requireRole(allowedRoles: AppRole[]): Promise<ViewerContext> {
  const viewer = await requireViewer()

  if (!allowedRoles.includes(viewer.role)) {
    throw forbidden("You do not have permission to perform this operation")
  }

  return viewer
}

function normalizeRole(value: unknown): AppRole {
  if (value === "nutritionist" || value === "assistant" || value === "admin") {
    return value
  }

  return DEFAULT_ROLE
}
