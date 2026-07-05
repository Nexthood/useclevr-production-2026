import { NextResponse } from "next/server"
import { requestDemoVerification, verifyDemoCode, validateDemoSession, getDemoLimits } from "@/lib/billing/demo-access"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, email, code } = body

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                      request.headers.get("x-real-ip") || 
                      undefined
    const userAgent = request.headers.get("user-agent") || undefined

    if (action === "request") {
      if (!email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 })
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
      }

      const result = await requestDemoVerification(email, ipAddress, userAgent)

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        remainingAttempts: result.remainingAttempts,
        resendCooldown: result.resendCooldown,
        message: "Verification code sent to your email",
      })
    }

    if (action === "verify") {
      if (!email || !code) {
        return NextResponse.json({ error: "Email and code are required" }, { status: 400 })
      }

      if (code.length !== 6 || !/^\d+$/.test(code)) {
        return NextResponse.json({ error: "Invalid code format" }, { status: 400 })
      }

      const result = await verifyDemoCode(email, code, ipAddress, userAgent)

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        sessionToken: result.sessionToken,
        usage: result.usage,
      })
    }

    if (action === "validate") {
      const sessionToken = request.headers.get("x-demo-session") || body.sessionToken

      if (!sessionToken) {
        return NextResponse.json({ error: "Session token required" }, { status: 400 })
      }

      const result = await validateDemoSession(sessionToken)

      if (!result.valid) {
        return NextResponse.json({ 
          valid: false, 
          reason: result.reason,
          emailRequired: true 
        }, { status: 401 })
      }

      return NextResponse.json({
        valid: true,
        email: result.email,
        usage: result.usage,
        limits: getDemoLimits(),
      })
    }

    if (action === "limits") {
      return NextResponse.json({
        limits: getDemoLimits(),
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("[DEMO_VERIFY] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const sessionToken = request.headers.get("x-demo-session")

  if (!sessionToken) {
    return NextResponse.json({ 
      valid: false,
      limits: getDemoLimits(),
    })
  }

  const result = await validateDemoSession(sessionToken)

  return NextResponse.json({
    valid: result.valid,
    email: result.email,
    usage: result.usage,
    reason: result.reason,
    limits: getDemoLimits(),
  })
}
