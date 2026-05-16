import Link from "next/link"
import { CreditCard, FileText, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"

export default async function BillingSettingsPage() {
  const session = await auth()
  const usage = await getAnalystCreditUsage(session?.user?.id)
  const planLabel = usage.subscriptionTier === "superadmin" ? "Super admin" : usage.subscriptionTier === "pro" ? "Pro" : "Free"

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Billing</CardTitle>
              <CardDescription>Invoices, payment status, and account plan details.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="mt-1 text-lg font-semibold">{planLabel}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Payment status</p>
              <p className="mt-1 text-lg font-semibold">Not connected</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Billing cycle</p>
              <p className="mt-1 text-lg font-semibold">{usage.subscriptionTier === "pro" ? "Monthly" : "None"}</p>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Payment provider not connected</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Plan selection, checkout review, and automatic discount logic are available. Card collection and invoices activate once the payment provider is configured.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/app/settings/subscription">
              <Button>Manage plan</Button>
            </Link>
            <Link href="/app/checkout?plan=pro_monthly&discount=auto">
              <Button variant="outline" className="bg-transparent">
                Preview checkout
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Invoice history
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-background p-6 text-center text-sm text-muted-foreground">
            No invoices yet.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
