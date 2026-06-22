import { BusinessProfileQuestionWizard } from "@/components/business/business-profile-question-wizard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Building2, CheckCircle2, ChevronRight, Sparkles, TriangleAlert } from "lucide-react"
import Link from "next/link"
import type { Metadata } from "next"
import { getSetupStatus } from "@/lib/business/company-setup-store"
import { auth } from "@/lib/auth/auth"

export const metadata: Metadata = {
  title: "Business - UseClevr",
}

export default async function BusinessPage() {
  const session = await auth()
  const userId = session?.user?.id
  const setupStatus = userId ? await getSetupStatus(userId) : null

  const completionPercent = setupStatus?.setupAccuracy ?? 0
  const hasIncompleteProfile = completionPercent < 80

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center px-5 pb-5 pt-6">
      <div className="mx-auto max-w-2xl text-center">
        <Building2 className="mx-auto mb-4 h-12 w-12 text-primary" />
        <h1 className="mb-2 text-2xl font-bold">Business Overview</h1>
        <p className="mb-6 text-muted-foreground">
          Manage the profile values that shape tax, payroll, margin, cash-flow, and risk analysis.
        </p>

        {hasIncompleteProfile ? (
          <Card className="mb-6 border-red-500/30 bg-red-500/10 text-left">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
                <AlertTriangle className="h-5 w-5" />
                Business Profile Required
              </CardTitle>
              <CardDescription className="text-red-700 dark:text-red-300">
                Tax, payroll, insurance, fixed costs, profitability, forecasting, and KPI calculations depend on Business Profile data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                Complete your Business Profile to get accurate analysis. Without it, profit margins, tax calculations, and cash-flow projections will be incomplete.
              </p>
              <Link
                href="/app/business/setup"
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Complete Business Profile ({completionPercent}%)
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6 border-emerald-500/30 bg-emerald-500/10 text-left">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="h-5 w-5" />
                Business Profile Complete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Your profile is {completionPercent}% complete. All analysis features are available.
              </p>
            </CardContent>
          </Card>
        )}

        {setupStatus?.accountantReviewFlags && setupStatus.accountantReviewFlags.length > 0 && (
          <Card className="mb-6 border-amber-500/30 bg-amber-500/10 text-left">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <TriangleAlert className="h-5 w-5" />
                Analysis Confidence Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                {setupStatus.accountantReviewFlags.slice(0, 3).map((flag) => (
                  <li key={flag}>• {flag}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <BusinessProfileQuestionWizard />
        <Link
          href="/app/business/setup"
          className="mt-3 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Open full setup page
          <ChevronRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
