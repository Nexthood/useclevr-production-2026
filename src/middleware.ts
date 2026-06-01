import { auth } from "@/lib/auth/auth"

const publicRoutes = [
  "/",
  "/login",
  "/signup",
  "/pricing",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/security",
  "/affiliate",
]

const publicPrefixes = ["/_next", "/api/auth", "/api/health", "/api/public", "/api/webhooks", "/demo", "/report"]

const apiPrefix = "/api"

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const pathname = nextUrl.pathname

  if (publicRoutes.includes(pathname)) {
    return
  }

  if (publicPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return
  }

  if (!isLoggedIn && pathname.startsWith(apiPrefix)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin)
    loginUrl.searchParams.set("callbackUrl", pathname + nextUrl.search)
    return Response.redirect(loginUrl)
  }

  if (pathname.startsWith("/app/admin") && req.auth?.user?.role !== "superadmin") {
    return Response.redirect(new URL("/app", nextUrl.origin))
  }
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
