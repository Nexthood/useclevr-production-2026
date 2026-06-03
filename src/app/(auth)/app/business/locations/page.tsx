import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { getPrimaryBusinessDetails } from "@/lib/business/business-store"
import { MapPin } from "lucide-react"

export const metadata = {
  title: "Business Locations - UseClevr",
}

export default async function BusinessLocationsPage() {
  const session = await auth()
  const details = await getPrimaryBusinessDetails(session?.user?.id)
  const safe = details ?? {}

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Locations & operations</CardTitle>
        <CardDescription>Review the primary operating location used for regional assumptions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">{safe.businessName || "Primary business profile"}</p>
              <p className="text-sm text-muted-foreground">{safe.location || "No operating location saved yet."}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
