import { archiveBusinessAction, restoreBusinessAction } from "@/app/actions/business"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { PageActionRow } from "@/components/ui/page-action-row"
import { auth } from "@/lib/auth"
import { getBusinessLimit, listUserBusinesses, type BusinessListRow } from "@/lib/business/business-store"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { Building2, CheckCircle2, CircleDashed, MapPin, Plus } from "lucide-react"
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
      </div>

      <PageActionRow description="Add or update the primary business details used by reports, tax settings, and account progress.">
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
      </PageActionRow>

      <DataTable
        title="Business listing"
        description="Profile, location, status, and completion for each business slot."
        emptyMessage="No businesses yet. Add details to create the primary business profile."
        rows={businesses as unknown as Record<string, unknown>[]}
        columns={businessColumns}
        rowKey={(row) => String(row.id)}
        minWidth="min-w-[880px]"
      />
    </div>
  )
}

const businessColumns: DataTableColumn<Record<string, unknown>>[] = [
  {
    key: "name",
    header: "Business",
    render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <Link href="/app/business/profile" className="font-medium text-foreground transition-colors hover:text-primary">
              {String(row.name)}
            </Link>
            <div>
              <Link href="/app/business/profile" className="text-xs text-primary hover:underline">
                Edit profile
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">{String(row.email)}</p>
          </div>
        </div>
    ),
  },
  {
    key: "industry",
    header: "Industry",
    render: (row) => <span className="text-muted-foreground">{String(row.industry)}</span>,
  },
  {
    key: "location",
    header: "Location",
    render: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {String(row.location)}
        </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => {
      const status = String(row.status || "draft") as BusinessListRow["status"]
      const StatusIcon = status === "active" ? CheckCircle2 : CircleDashed
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)

      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground">
          <StatusIcon className="h-3.5 w-3.5" />
          {statusLabel}
        </span>
      )
    },
  },
  {
    key: "completion",
    header: "Completion",
    render: (row) => {
      const completion = Number(row.completion || 0)

      return (
        <div className="flex min-w-32 items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${completion}%` }} />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{completion}%</span>
        </div>
      )
    },
  },
  {
    key: "actions",
    header: "Actions",
    align: "right",
    render: (row) => {
      const status = String(row.status || "draft")
      const action = status === "archived" ? restoreBusinessAction : archiveBusinessAction
      const label = status === "archived" ? "Restore" : "Archive"

      if (row.canArchive === false) {
        return <span className="text-sm text-muted-foreground">Profile source</span>
      }

      return (
        <form action={action}>
          <input type="hidden" name="id" value={String(row.id)} />
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            {label}
          </button>
        </form>
      )
    },
  },
]
