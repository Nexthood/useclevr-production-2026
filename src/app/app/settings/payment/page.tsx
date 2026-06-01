import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth/auth";
import { CheckCircle2, CreditCard, ShieldAlert, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

export default async function PaymentSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "superadmin") {
    redirect("/app/settings/subscription");
  }

  const keyConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Payment readiness</CardTitle>
              <CardDescription>
                Check whether checkout, subscription updates, and invoice events can run.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Checkout</p>
              </div>
              <p className="mt-1 text-lg font-semibold">
                {keyConfigured ? "Ready" : "Needs setup"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Plan sync</p>
              </div>
              <p className="mt-1 text-lg font-semibold">
                {webhookConfigured ? "Ready" : "Needs setup"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                {keyConfigured && webhookConfigured ? (
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                )}
                <p className="text-sm text-muted-foreground">Customer billing</p>
              </div>
              <p className="mt-1 text-lg font-semibold">
                {keyConfigured && webhookConfigured ? "Active" : "Paused"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-medium">Operator checklist</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                Checkout can create hosted payment sessions:{" "}
                {keyConfigured ? "ready" : "needs setup"}.
              </li>
              <li>
                Subscription changes can update customer plans automatically:{" "}
                {webhookConfigured ? "ready" : "needs setup"}.
              </li>
              <li>Customers only see paid checkout after the provider is ready.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              Set the environment variables on your hosting platform (Railway, Vercel, etc.) and
              redeploy. Subscriptions, card collection, and invoices activate automatically once
              both variables are present.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
