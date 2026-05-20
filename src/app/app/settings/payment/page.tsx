import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Key, Link2, ShieldCheck } from "lucide-react"

export default async function PaymentSettingsPage() {
  const keyConfigured = Boolean(process.env.STRIPE_SECRET_KEY)
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET)

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Payment provider</CardTitle>
              <CardDescription>Configure Stripe for subscriptions and checkout.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Secret key</p>
              </div>
              <p className="mt-1 text-lg font-semibold">{keyConfigured ? "CONFIGURED" : "NOT SET"}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Webhook secret</p>
              </div>
              <p className="mt-1 text-lg font-semibold">{webhookConfigured ? "CONFIGURED" : "NOT SET"}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Status</p>
              </div>
              <p className="mt-1 text-lg font-semibold">
                {keyConfigured && webhookConfigured ? "ACTIVE" : "INCOMPLETE"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-medium">Environment variables</p>
            <div className="mt-2 space-y-2 text-sm text-muted-foreground">
              <p><code className="rounded bg-muted px-1.5 py-0.5 text-xs">STRIPE_SECRET_KEY</code> — Stripe secret key (sk_test_…)</p>
              <p><code className="rounded bg-muted px-1.5 py-0.5 text-xs">STRIPE_WEBHOOK_SECRET</code> — Stripe webhook signing secret (whsec_…)</p>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              Set the environment variables on your hosting platform (Railway, Vercel, etc.) and redeploy.
              Subscriptions, card collection, and invoices activate automatically once both variables are present.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
