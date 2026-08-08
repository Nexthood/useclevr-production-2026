import { auth } from "@/lib/auth/auth"
import { getCreditAccount, getTransactionLedger, getSpendingLimits, checkSpendingLimits } from "@/lib/billing/credit-account-service"
import { getBillingPlanByTier } from "@/lib/billing/plans"
import { CreditCard, TrendingUp, ArrowUpRight, ShieldAlert, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

async function getAccountData(userId: string) {
  const [account, transactions, limits, spendingCheck] = await Promise.all([
    getCreditAccount(userId),
    getTransactionLedger(userId, { limit: 50 }),
    getSpendingLimits(userId),
    checkSpendingLimits(userId),
  ])

  const plan = account ? getBillingPlanByTier(account.tier) : null

  return {
    account,
    plan,
    transactions,
    limits,
    spendingCheck,
  }
}

export default async function BillingUsagePage() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return <div className="p-6">Unauthorized</div>
  }

  const { account, plan, transactions, limits, spendingCheck } = await getAccountData(userId)

  if (!account) {
    return (
      <div className="p-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Unlimited Access</CardTitle>
            <CardDescription>Your account has unlimited credits and does not use the standard credit system.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const includedPercent = plan ? Math.min(100, Math.round((account.includedBalance / plan.limits.monthlyCredits) * 100)) : 0

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Billing & Usage</h1>
          <p className="text-sm text-muted-foreground">
            {plan?.name || account.planId} plan · Included + purchased credits
          </p>
        </div>
      </div>

      {spendingCheck.blocked && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-50 p-4 dark:bg-amber-950/10">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Limit reached</p>
            <p className="text-sm text-amber-700/90 dark:text-amber-400/90">{spendingCheck.reason}</p>
          </div>
        </div>
      )}

      {!spendingCheck.blocked && spendingCheck.reason && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Notice</p>
            <p className="text-sm text-muted-foreground">{spendingCheck.reason}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Included Credits</CardDescription>
            <CardTitle className="text-2xl">{account.includedBalance.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {plan ? `${plan.limits.monthlyCredits.toLocaleString()} monthly allowance` : "Plan allowance"}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500" style={{ width: `${includedPercent}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Resets {new Date(account.creditsResetAt).toLocaleDateString()}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Purchased Credits</CardDescription>
            <CardTitle className="text-2xl">{account.purchasedBalance.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Paid value: {(account.totalPaidCents / 100).toLocaleString(undefined, { style: "currency", currency: account.currency })}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs text-muted-foreground">Top-up balance</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Total Available</CardDescription>
            <CardTitle className="text-2xl">{account.totalAvailableBalance.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {account.usedCredits.toLocaleString()} used · {account.reservedCredits.toLocaleString()} reserved
            </p>
            <div className="mt-2 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">{account.remainingCredits.toLocaleString()} remaining</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Next Reset</CardDescription>
            <CardTitle className="text-lg">{new Date(account.creditsResetAt).toLocaleDateString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Included credits reset on this date. Purchased credits are preserved.
            </p>
            <div className="mt-2">
              <Link href="/app/settings/checkout">
                <Button size="sm" className="w-full">
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Purchase credits
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Complete ledger of credit movements.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2 pr-4">Module</th>
                  <th className="pb-2 pr-4">Credits</th>
                  <th className="pb-2 pr-4">Balance After</th>
                  <th className="pb-2 pr-4">Source</th>
                  <th className="pb-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">No transactions yet.</td>
                  </tr>
                )}
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{tx.action}</td>
                    <td className="py-2 pr-4">{tx.feature || "—"}</td>
                    <td className={`py-2 pr-4 font-medium ${(tx.credits || tx.amount || 0) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                      {(tx.credits || tx.amount || 0) >= 0 ? "+" : ""}{(tx.credits || tx.amount || 0).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{tx.balanceAfter.toLocaleString()}</td>
                    <td className="py-2 pr-4 capitalize">{tx.source || "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground">{tx.description?.slice(0, 80) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Spending Controls</CardTitle>
          <CardDescription>Set limits and warnings for purchased credit usage.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/billing/spending-limits" method="post" className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Monthly purchased credit limit</label>
              <input
                type="number"
                name="monthlyPurchasedLimit"
                defaultValue={limits?.monthlyPurchasedLimit ?? ""}
                placeholder="No limit"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Low balance warning (%)</label>
              <input
                type="number"
                name="lowBalanceWarningPercent"
                defaultValue={limits?.lowBalanceWarningPercent ?? 20}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoTopUp"
                name="autoTopUpEnabled"
                defaultChecked={limits?.autoTopUpEnabled ?? false}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="autoTopUp" className="text-sm text-foreground">Enable auto top-up</label>
            </div>
            <div className="flex items-end">
              <Button type="submit" size="sm">Save limits</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
