"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { toActionError } from "@/server/core/errors"
import { fail, ok } from "@/server/core/result"
import { formDataToObject, parseWithSchema } from "@/server/core/validation"
import {
  forgotPasswordSchema,
  loginSchema,
  registerClientSchema,
  registerSchema,
} from "@/server/schemas/auth.schemas"
import { withTimeout } from "@/lib/utils/with-timeout"

const AUTH_OP_TIMEOUT_MS = 8000

export type AppRole = "super_admin" | "nutritionist" | "client"

export interface LoginFormState {
  success: boolean
  message: string | null
}

function roleRedirect(role: string | null | undefined): string {
  switch (role) {
    case "super_admin":
      return "/admin"
    case "client":
      return "/cliente"
    case "nutritionist":
    default:
      return "/dashboard"
  }
}

export async function login(formData: FormData) {
  try {
    const supabase = await createClient()
    const input = parseWithSchema(loginSchema, formDataToObject(formData))

    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      }),
      AUTH_OP_TIMEOUT_MS,
      "Login request",
    )

    if (error) {
      return fail({ code: "UNAUTHORIZED", message: error.message })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    let role: string = "nutritionist"
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle()

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut()
        return fail({ code: "UNAUTHORIZED", message: "Conta desativada. Contacte o administrador." })
      }
      role = profile?.role ?? "nutritionist"
    }

    revalidatePath("/", "layout")
    return ok({ redirectTo: roleRedirect(role) as "/admin" | "/cliente" | "/dashboard" })
  } catch (error) {
    return fail(toActionError(error))
  }
}

export async function loginWithState(_: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const result = await login(formData)

  if (!result.success) {
    return {
      success: false,
      message: result.error.message,
    }
  }

  return {
    success: true,
    message: null,
  }
}

/** Self-service registration for clients only */
export async function registerClient(formData: FormData) {
  try {
    const supabase = await createClient()
    const input = parseWithSchema(registerClientSchema, formDataToObject(formData))

    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
          `${process.env.NEXT_PUBLIC_SITE_URL || ""}/login`,
        data: {
          full_name: input.full_name,
          phone: input.phone || null,
          role: "client",
        },
      },
    })

    if (error) {
      return fail({ code: "CONFLICT", message: error.message })
    }

    return ok({ redirectTo: "/register/success" as const })
  } catch (error) {
    return fail(toActionError(error))
  }
}

/** Kept for backwards compatibility; prefer registerClient or adminCreateUser */
export async function register(formData: FormData) {
  try {
    const supabase = await createClient()
    const input = parseWithSchema(registerSchema, formDataToObject(formData))
    const role = input.role === "client" ? "client" : "nutritionist"

    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
          `${process.env.NEXT_PUBLIC_SITE_URL || ""}/login`,
        data: {
          full_name: input.full_name,
          clinic_name: input.clinic_name || null,
          crn: input.crn || null,
          phone: input.phone || null,
          role,
        },
      },
    })

    if (error) {
      return fail({ code: "CONFLICT", message: error.message })
    }

    return ok({ redirectTo: "/register/success" as const })
  } catch (error) {
    return fail(toActionError(error))
  }
}

export async function forgotPassword(formData: FormData) {
  try {
    const supabase = await createClient()
    const input = parseWithSchema(forgotPasswordSchema, formDataToObject(formData))

    const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo:
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
        `${process.env.NEXT_PUBLIC_SITE_URL || ""}/login`,
    })

    if (error) {
      return fail({ code: "DATABASE_ERROR", message: error.message })
    }

    return ok({ email: input.email })
  } catch (error) {
    return fail(toActionError(error))
  }
}

export async function signOut() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.error("Sign-out failed:", error)
  }
  revalidatePath("/", "layout")
  redirect("/login")
}

export async function getSession() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await withTimeout(supabase.auth.getUser(), AUTH_OP_TIMEOUT_MS, "Session lookup")
    return user
  } catch (error) {
    console.error("getSession failed:", error)
    return null
  }
}

export async function getProfile() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await withTimeout(supabase.auth.getUser(), AUTH_OP_TIMEOUT_MS, "Profile auth lookup")
    if (!user) return null

    const { data, error } = await withTimeout(
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      AUTH_OP_TIMEOUT_MS,
      "Profile query",
    )

    if (error) {
      console.error("getProfile query failed:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("getProfile failed:", error)
    return null
  }
}

export async function requireRole(allowed: AppRole[]) {
  const profile = await getProfile()
  if (!profile || !allowed.includes(profile.role as AppRole)) {
    redirect("/login")
  }
  return profile
}
