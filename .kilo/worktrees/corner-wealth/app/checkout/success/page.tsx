import { getCheckoutSession } from "@/app/actions/stripe"
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

  let session = null
  if (session_id) {
    try {
      session = await getCheckoutSession(session_id)
    } catch (error) {
      console.error("Error fetching session:", error)
    }
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
                  {(session.customer as any)?.email || session.customer_email}
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
