import Link from "next/link"
import { CreditCard, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"

export default async function SubscriptionSettingsPage() {
  const session = await auth()
  const usage = await getAnalystCreditUsage(session?.user?.id)
  const remaining = Math.max(0, usage.total - usage.analysisCount)
  const isUnlimited = usage.subscriptionTier === "pro" || usage.subscriptionTier === "superadmin"

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-foreground">Subscription</CardTitle>
            <CardDescription className="text-muted-foreground">Manage your plan and billing.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
          <div>
            <p className="font-medium text-foreground">Current plan</p>
            <p className="text-sm text-muted-foreground">
              {usage.subscriptionTier === "superadmin" ? "Super admin" : isUnlimited ? "Pro tier" : "Free tier"}
            </p>
          </div>
          {!isUnlimited && (
            <Link href="/pricing">
              <Button variant="outline" size="sm">Upgrade</Button>
            </Link>
          )}
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-primary/15 p-2 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-foreground">Analyst credits</p>
              <p className="text-sm text-muted-foreground">
                {isUnlimited ? "Unlimited analyst usage" : `${usage.analysisCount} / ${usage.total} free credits used`}
              </p>
              {!isUnlimited && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {usage.limitReached
                    ? "Free credits are used. Subscribe to Pro or top up to continue analysis."
                    : `${remaining} free ${remaining === 1 ? "credit" : "credits"} remaining.`}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
