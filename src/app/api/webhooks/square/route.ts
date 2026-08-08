import { handleSquareCreditPaymentEvent, verifySquareWebhookSignature } from "@/services/square/credit-webhook"
import { debugError } from "@/lib/utils/debug"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const headers = Object.fromEntries(
    [...request.headers.entries()].map(([key, value]) => [key.toLowerCase(), value]),
  )

  const signature = headers["x-square-hmacsha256-signature"]

  const notificationUrl =
    process.env.SQUARE_CREDITS_WEBHOOK_NOTIFICATION_URL?.trim() ||
    process.env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim()

  if (!notificationUrl) {
    return NextResponse.json(
      { error: "Square webhook notification URL is not configured." },
      { status: 500 },
    )
  }

  const verification = verifySquareWebhookSignature(signature || null, notificationUrl, rawBody)
  if (!verification.valid) {
    debugError("[square-credit-webhook] Signature verification failed:", verification.error)
    return NextResponse.json({ error: verification.error }, { status: 401 })
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  try {
    const result = await handleSquareCreditPaymentEvent(parsedBody)

    return NextResponse.json({
      received: true,
      type: (parsedBody as { type?: string })?.type || "unknown",
      creditTopUp: {
        processed: result.processed,
        synced: result.synced,
        creditsIssued: result.creditsIssued,
        duplicate: result.duplicate,
        ...(result.reason ? { reason: result.reason } : {}),
      },
    })
  } catch (err) {
    debugError("[square-credit-webhook] handler error:", err)
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 })
  }
}
