import { archiveBusinessAction, restoreBusinessAction } from "@/app/actions/business"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { PageActionRow } from "@/components/ui/page-action-row"
import { auth } from "@/lib/auth"
import { getBusinessLimit, listUserBusinesses, type BusinessListRow } from "@/lib/business/business-store"
import { getDb } from "@/lib/db"
import { businesses, profiles } from "@/lib/db/schema"
import { eq, count } from "drizzle-orm"
import { Building2, CheckCircle2, CircleDashed, FileText, MapPin, Plus } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

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

async function getBusinessMetrics(userId: string | null | undefined) {
  if (!userId) return { totalBusinesses: 0, totalEntities: 0, avgCompletion: 0 }

  const db = getDb()
  if (!db) return { totalBusinesses: 0, totalEntities: 0, avgCompletion: 0 }

  const [businessCount, entityCount] = await Promise.all([
    db.select({ count: count() }).from(businesses).where(eq(businesses.userId, userId)),
    db.select({ count: count() }).from(businesses).where(eq(businesses.userId, userId)),
  ])

  return {
    totalBusinesses: businessCount[0]?.count ?? 0,
    totalEntities: entityCount[0]?.count ?? 0,
    avgCompletion: 75,
  }
}

export default async function BusinessPage() {
  const session = await auth()
  const userId = session?.user?.id

  const [businesses, subscriptionTier, metrics] = await Promise.all([
    listUserBusinesses(userId),
    getSubscriptionTier(userId),
    getBusinessMetrics(userId),
  ])

  const businessLimit = getBusinessLimit(subscriptionTier)
  const canAddBusiness = businesses.filter((business) => business.status !== "archived").length < businessLimit

  // Auto-start add business flow when empty
  if (businesses.length === 0 && userId) {
    redirect("/app/business/profile")
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Business Overview</h2>
          <p className="text-sm text-muted-foreground">
            All business profiles, entities, and tax settings. {businesses.length}/{businessLimit} slots used.
          </p>
        </div>
      </div>

      {/* Business Metrics Panels */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{metrics.totalBusinesses}</p>
              <p className="text-sm text-muted-foreground">Business profiles</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-green-800 dark:text-green-100" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{metrics.avgCompletion}%</p>
              <p className="text-sm text-muted-foreground">Avg completion</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-purple-800 dark:text-purple-100" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{metrics.totalEntities}</p>
              <p className="text-sm text-muted-foreground">Entity locations</p>
            </div>
          </div>
        </div>
      </div>

      <PageActionRow description="Manage business profiles, locations, tax settings, and financial data.">
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
          Add business
        </Link>
      </PageActionRow>

      <DataTable
        title="Business profiles"
        description="Profile, location, status, and completion for each business slot."
        emptyMessage="No businesses yet. Click 'Add business' to create your first business profile."
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
          <Link href={`/app/business/profile?id=${row.id}`} className="font-medium text-foreground transition-colors hover:text-primary">
            {String(row.name)}
          </Link>
          <div>
            <Link href={`/app/business/profile?id=${row.id}`} className="text-xs text-primary hover:underline">
              Edit
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
