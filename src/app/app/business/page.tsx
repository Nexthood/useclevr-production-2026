import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import type { BusinessDetails } from "@/lib/business/business-profile"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { Building2, CheckCircle2, CircleDashed, MapPin, Pencil, Plus, ShieldCheck } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Business - UseClevr",
}

type BusinessRow = {
  name: string
  email: string
  industry: string
  location: string
  completion: number
  status: "Active" | "Draft" | "Not started"
}

function completionPercent(details: BusinessDetails) {
  const values = Object.values(details)
  const filled = values.filter((value) => value.trim().length > 0).length
  return Math.round((filled / values.length) * 100)
}

async function getBusinessRow(userId: string | null | undefined): Promise<BusinessRow> {
  if (!userId) {
    return {
      name: "Primary business profile",
      email: "Not set",
      industry: "Not set",
      location: "Not set",
      completion: 0,
      status: "Not started",
    }
  }

  const db = getDb()
  if (!db) {
    return {
      name: "Primary business profile",
      email: "Database unavailable",
      industry: "Not set",
      location: "Not set",
      completion: 0,
      status: "Not started",
    }
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: {
      businessName: true,
      businessEmail: true,
      industry: true,
      location: true,
      website: true,
      businessDescription: true,
    },
  })

  const details = {
    businessName: profile?.businessName ?? "",
    businessEmail: profile?.businessEmail ?? "",
    industry: profile?.industry ?? "",
    location: profile?.location ?? "",
    website: profile?.website ?? "",
    businessDescription: profile?.businessDescription ?? "",
  }
  const completion = completionPercent(details)

  return {
    name: details.businessName || "Primary business profile",
    email: details.businessEmail || "Not set",
    industry: details.industry || "Not set",
    location: details.location || "Not set",
    completion,
    status: completion === 100 ? "Active" : completion > 0 ? "Draft" : "Not started",
  }
}

export default async function BusinessPage() {
  const session = await auth()
  const business = await getBusinessRow(session?.user?.id)
  const statusIcon = business.status === "Active" ? CheckCircle2 : CircleDashed
  const StatusIcon = statusIcon

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Businesses</h2>
          <p className="text-sm text-muted-foreground">Your business list is the entry point for profile, location, tax, and review settings.</p>
        </div>
        <Link
          href="/app/business/profile"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add details
        </Link>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Business listing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4 font-medium">Business</th>
                  <th className="py-3 pr-4 font-medium">Industry</th>
                  <th className="py-3 pr-4 font-medium">Location</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Completion</th>
                  <th className="py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/70">
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{business.name}</p>
                        <p className="text-xs text-muted-foreground">{business.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-muted-foreground">{business.industry}</td>
                  <td className="py-4 pr-4 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {business.location}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground">
                      <StatusIcon className="h-3.5 w-3.5" />
                      {business.status}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex min-w-32 items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${business.completion}%` }} />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{business.completion}%</span>
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href="/app/business/profile"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                        Profile
                      </Link>
                      <Link
                        href="/app/business/review"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Review
                      </Link>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
