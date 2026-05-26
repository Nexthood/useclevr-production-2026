import { archiveBusinessAction, restoreBusinessAction } from "@/app/actions/business"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getBusinessLimit, listUserBusinesses, type BusinessListRow } from "@/lib/business/business-store"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { Archive, Building2, CheckCircle2, CircleDashed, MapPin, Pencil, Plus, RotateCcw, ShieldCheck } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Business - UseClevr",
}

async function getSubscriptionTier(userId: string | null | undefined) {
  if (!userId) return "free"
  const db = getDb()
  if (!db) return "free"

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { subscriptionTier: true },
  })
  return profile?.subscriptionTier || "free"
}

export default async function BusinessPage() {
  const session = await auth()
  const [businesses, subscriptionTier] = await Promise.all([
    listUserBusinesses(session?.user?.id),
    getSubscriptionTier(session?.user?.id),
  ])
  const businessLimit = getBusinessLimit(subscriptionTier)
  const canAddBusiness = businesses.filter((business) => business.status !== "archived").length < businessLimit

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Businesses</h2>
          <p className="text-sm text-muted-foreground">
            Your business list is the entry point for profile, location, tax, and review settings. {businesses.length}/{businessLimit} slots used.
          </p>
        </div>
        <Link
          href="/app/business/profile"
          aria-disabled={!canAddBusiness}
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition ${
            canAddBusiness
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "pointer-events-none bg-muted text-muted-foreground"
          }`}
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
                {businesses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No businesses yet. Add details to create the primary business profile.
                    </td>
                  </tr>
                ) : (
                  businesses.map((business) => <BusinessTableRow key={business.id} business={business} />)
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BusinessTableRow({ business }: { business: BusinessListRow }) {
  const StatusIcon = business.status === "active" ? CheckCircle2 : CircleDashed
  const statusLabel = business.status.charAt(0).toUpperCase() + business.status.slice(1)

  return (
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
          {statusLabel}
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
          <form action={business.status === "archived" ? restoreBusinessAction : archiveBusinessAction}>
            <input type="hidden" name="id" value={business.id} />
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              {business.status === "archived" ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {business.status === "archived" ? "Restore" : "Archive"}
            </button>
          </form>
        </div>
      </td>
    </tr>
  )
}
