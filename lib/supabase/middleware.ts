import { type NextRequest, NextResponse } from "next/server"
import { fallbackLng, localeCookieName, resolveLanguage } from "@/i18n/settings"

function setLocaleCookie(response: NextResponse, locale: string) {
  if (!response.cookies.get(localeCookieName)?.value) {
    response.cookies.set(localeCookieName, locale || fallbackLng, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
  }
}

export async function updateSession(request: NextRequest) {
  const detectedLocale = resolveLanguage(
    request.cookies.get(localeCookieName)?.value ?? request.headers.get("accept-language")?.split(",")[0],
  )
  const pathname = request.nextUrl.pathname
  const isDashboardRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/post-login")
  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        Boolean(cookie.value) &&
        (cookie.name.includes("auth-token") || cookie.name.startsWith("sb-")),
    )

  if (isDashboardRoute && !hasAuthCookie) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    const response = NextResponse.redirect(url)
    setLocaleCookie(response, detectedLocale)
    return response
  }

  const supabaseResponse = NextResponse.next({ request })
  setLocaleCookie(supabaseResponse, detectedLocale)
  return supabaseResponse
}
