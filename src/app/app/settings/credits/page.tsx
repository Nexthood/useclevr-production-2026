import { redirect } from "next/navigation"
import { ShieldCheck, SlidersHorizontal } from "lucide-react"
import { auth } from "@/lib/auth"
import { FREE_ANALYST_CREDITS } from "@/lib/usage/analyst-credits"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const roleLimits = [
  { role: "Free customer", totalCredits: FREE_ANALYST_CREDITS },
  { role: "Pro customer", totalCredits: "Unlimited" },
  { role: "Super admin", totalCredits: "Unlimited" },
]

export default async function CreditRulesSettingsPage() {
  const session = await auth()

  if (session?.user?.role !== "superadmin") {
    redirect("/app/settings/subscription")
  }

  return (
    <div className="space-y-5">
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-foreground">Credit Rules</CardTitle>
              <CardDescription className="text-muted-foreground">
                Super admin view for the current dataset credit model.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium text-foreground">Current source of truth</p>
            <p className="mt-1 text-sm text-muted-foreground">
              One uploaded dataset counts as one analyst credit. Usage is calculated from the
              number of rows owned by the user in the Dataset table.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="datasetsPerCredit">Datasets per credit</Label>
              <Input id="datasetsPerCredit" value="1" readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="featuresPerCredit">Features included per credit</Label>
              <Input id="featuresPerCredit" value="All dataset analysis features" readOnly />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-foreground">Role Limits</CardTitle>
              <CardDescription className="text-muted-foreground">
                These values reflect the active hard-coded limits.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border">
            {roleLimits.map((item) => (
              <div
                key={item.role}
                className="grid grid-cols-2 gap-4 border-b border-border px-4 py-3 last:border-b-0"
              >
                <p className="text-sm font-medium text-foreground">{item.role}</p>
                <p className="text-sm text-muted-foreground">{item.totalCredits}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
