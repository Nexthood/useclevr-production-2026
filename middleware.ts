import { auth } from "@/lib/auth"

export default auth((req) => {
  const { nextUrl } = req
  const isAppRoute = nextUrl.pathname === "/app" || nextUrl.pathname.startsWith("/app/")

  if (isAppRoute && !req.auth) {
    return Response.redirect(new URL("/login", nextUrl))
  }
})

export const config = {
  matcher: ["/app/:path*"],
}
