import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getBusinessReviewFlags } from "@/lib/business/business-profile"
import { getPrimaryBusinessDetails } from "@/lib/business/business-store"
import { auth } from "@/lib/auth"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export const metadata = {
  title: "Business Review - UseClevr",
}

export default async function BusinessReviewPage() {
  const session = await auth()
  const details = await getPrimaryBusinessDetails(session?.user?.id)
  const flags = getBusinessReviewFlags(details)

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Review & validation</CardTitle>
        <CardDescription>Check whether the business profile is ready for confident reports and AI analysis.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {flags.map((flag) => (
          <div key={flag.label} className="flex gap-3 rounded-lg border border-border bg-background p-4 text-sm">
            {flag.complete ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            )}
            <div>
              <p className="font-medium text-foreground">{flag.label}</p>
              <p className="text-muted-foreground">{flag.complete ? "Ready" : flag.help}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
