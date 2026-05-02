import { auth } from "@/lib/auth"

export default auth((req) => {
  const { nextUrl } = req
  const isAppRoute = nextUrl.pathname === "/app" || nextUrl.pathname.startsWith("/app/")

  if (isAppRoute && !req.auth) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`)
    return Response.redirect(loginUrl)
  }
})

export const config = {
  matcher: ["/app/:path*"],
}
