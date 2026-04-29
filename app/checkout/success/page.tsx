import { debugLog, debugError, debugWarn } from "@/lib/debug"

import { getCheckoutSession } from "@/app/actions/stripe"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { PublicHeader } from "@/components/public-header"
import { PublicFooter } from "@/components/public-footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Payment Successful - UseClevr",
  description: "Your subscription is now active",
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams

  let session: Awaited<ReturnType<typeof getCheckoutSession>> = null
  if (session_id) {
    try {
      session = await getCheckoutSession(session_id)
    } catch (error) {
      debugError("Error fetching session:", error)
    }
  }

  // Minimal unlock + guidance: if this checkout was for Hybrid AI Lite,
  // set cookie so the modal unlocks Lite and redirect to app with setup hint
  try {
    const isLite = Boolean(session && "metadata" in session && session.metadata?.productId === "hybrid_ai_lite")
    if (isLite) {
      const store = await cookies()
      store.set("hybridAiLiteEnabled", "1", { path: "/", maxAge: 60 * 60 * 24 * 365 })
      // Send user directly to dashboard where Hybrid AI modal lives, with hint to open Lite setup
      // Do not auto-start any downloads or runtime; only provide UI context.
      return redirect("/app?hybrid=lite&setup=1")
    }
  } catch (e) {
    // Non-fatal if cookie cannot be set
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Payment Successful!</h1>
            <p className="text-muted-foreground">
              Thank you for subscribing to UseClevr Pro. Your account has been upgraded.
            </p>
          </div>

          {session && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
              <p>
                A confirmation email has been sent to{" "}
                <span className="font-medium text-foreground">
                  {"your email"}
                </span>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Link href="/app">
              <Button className="w-full bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] hover:opacity-90 text-white">
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full bg-transparent">
                Back to Home
              </Button>
            </Link>
          </div>
        </Card>
      </main>

      <PublicFooter />
    </div>
  )
}
