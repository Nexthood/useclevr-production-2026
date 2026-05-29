import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits";
import { CreditCard, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default async function BillingSettingsPage() {
  const session = await auth();
  const usage = await getAnalystCreditUsage(session?.user?.id);
  const planLabel =
    usage.subscriptionTier === "superadmin"
      ? "Super admin"
      : usage.subscriptionTier === "pro"
        ? "Pro"
        : "Free";

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-cyan-800 dark:text-cyan-100" />
            </div>
            <div>
              <CardTitle>Billing</CardTitle>
              <CardDescription>Invoices, payment status, and account plan details.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/30 p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Current plan
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">{planLabel}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Payment status
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">Not connected</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Billing cycle
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {usage.subscriptionTier === "pro" ? "Monthly" : "None"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Payment provider not connected</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Plan selection, checkout review, and automatic discount logic are available. Card
                  collection and invoices activate once the payment provider is configured.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/app/settings/subscription">
              <Button>Manage plan</Button>
            </Link>
            <Link href="/app/settings/checkout?plan=pro_monthly&discount=auto">
              <Button variant="outline" className="bg-transparent">
                Preview checkout
              </Button>
            </Link>
            <a href="mailto:sales@useclevr.com">
              <Button variant="outline" className="bg-transparent">
                Contact sales
              </Button>
            </a>
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
        <CardContent className="p-0">
          <div className="overflow-hidden rounded-b-lg border-t border-border">
            <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr] bg-muted/30 px-5 py-3 text-xs font-medium text-muted-foreground">
              <span>Invoice</span>
              <span>Status</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No invoices yet.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
