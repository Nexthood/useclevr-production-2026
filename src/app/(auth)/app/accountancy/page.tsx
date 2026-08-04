import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { AccountancyPackageForm } from "@/components/accountancy/accountancy-package-form"
import { AccountancyUpload } from "@/components/accountancy/accountancy-upload"
import { Card } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import {
  MISSING_BUSINESS_PROFILE_VALUE,
  displayBusinessProfileValue,
  getBusinessProfileForCurrentTenant,
} from "@/lib/business/current-business-profile"
import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Landmark,
  Upload,
} from "lucide-react"
import Link from "next/link"
import type React from "react"

import { getDatasetCategoryLabel, resolveDatasetType } from "@/lib/data/dataset-category"

export const metadata = {
  title: "Accountancy - UseClevr",
}

type AccountancyPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function AccountancyPage({ searchParams }: AccountancyPageProps) {
  const businessProfileResult = await getBusinessProfileForCurrentTenant()
  const userId = businessProfileResult.userId
  const profileLoadFailed = businessProfileResult.status === "error"
  const companySetup = businessProfileResult.setup

  let activeDatasets = 0
  let focusedDataset: {
    id: string
    name: string
    fileName: string
    rowCount: number
    columnCount: number
    analysis: unknown
    precomputedMetrics: unknown
    datasetType: string | null
  } | null = null
  const resolvedSearchParams = await searchParams
  const rawDatasetId = resolvedSearchParams?.datasetId
  const focusedDatasetId = Array.isArray(rawDatasetId) ? rawDatasetId[0] : rawDatasetId

  if (userId) {
    const db = getDb()
    if (db) {
      try {
        const accountancyDatasets = await db.query.datasets.findMany({
          where: eq(datasets.userId, userId),
          columns: {
            datasetType: true,
            analysis: true,
          },
        })

        if (focusedDatasetId) {
          const datasetWhere = and(eq(datasets.id, focusedDatasetId), eq(datasets.userId, userId))
          focusedDataset = await db.query.datasets.findFirst({
            where: datasetWhere,
            columns: {
              id: true,
              name: true,
              fileName: true,
              rowCount: true,
              columnCount: true,
              analysis: true,
              precomputedMetrics: true,
              datasetType: true,
            },
          }) ?? null
          if (focusedDataset && resolveDatasetType(focusedDataset.datasetType, focusedDataset.analysis) !== "accountancy") {
            focusedDataset = null
          }
        }

        activeDatasets = accountancyDatasets.filter((dataset) =>
          resolveDatasetType(dataset.datasetType, dataset.analysis) === "accountancy"
        ).length
      } catch (error) {
        console.warn("[ACCOUNTANCY] Dataset summary unavailable.", error)
        // Continue without counts; the Pre-Bookkeeping Center remains usable without DB stats.
      }
    }
  }

  const profileComplete = !profileLoadFailed && Boolean(companySetup?.setupStatus.completed)
  const companyName = companySetup?.companyInfo.companyName || ""
  const sharedBusinessProfile = businessProfileResult.profile ?? {
    taxCountry: null,
    currency: null,
    fiscalYear: null,
    vatSalesTax: null,
    payroll: null,
    fixedCosts: null,
  }
  const taxPeriod = displayBusinessProfileValue(sharedBusinessProfile.fiscalYear)
  const taxCountry = displayBusinessProfileValue(sharedBusinessProfile.taxCountry)
  const currency = displayBusinessProfileValue(sharedBusinessProfile.currency)
  const taxSummary = displayBusinessProfileValue(sharedBusinessProfile.vatSalesTax)
  const payrollSummary = displayBusinessProfileValue(sharedBusinessProfile.payroll)
  const fixedCostSummary = displayBusinessProfileValue(sharedBusinessProfile.fixedCosts)
  const profileContextRows = [
    { label: "Tax country", value: taxCountry },
    { label: "Currency", value: currency },
    { label: "Fiscal year", value: taxPeriod || MISSING_BUSINESS_PROFILE_VALUE },
    { label: "VAT/sales tax", value: taxSummary },
    { label: "Payroll", value: payrollSummary },
    { label: "Fixed costs", value: fixedCostSummary },
  ]

  const bookkeepingRows = [
    {
      id: "bank-reconciliation",
      title: "Bank reconciliation",
      description: "Match imported statements against dataset totals.",
      status: "Ready",
      href: "/app/accountancy/reporting",
    },
    {
      id: "expense-coding",
      title: "Expense coding",
      description: "Review uncategorised payments, supplier costs, and tax categories.",
      status: "Available",
      href: "/app/accountancy/reporting",
    },
    {
      id: "monthly-close",
      title: "Monthly close",
      description: "Track close steps for business profiles with connected records.",
      status: profileComplete ? "Ready" : "Needs profile",
      href: profileComplete ? "/app/accountancy/compliance" : "/app/business",
    },
  ]

  const rightSidebar = (
    <aside className="hidden w-80 flex-shrink-0 border-l border-border bg-card lg:block">
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <div className="space-y-4">
          <Card className="border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Monthly close</h2>
                <p className="mt-1 text-xs text-muted-foreground">Current readiness for accounting review.</p>
              </div>
              <Landmark className="h-5 w-5 flex-shrink-0 text-primary" />
            </div>
            <div className="space-y-3">
              <CloseStep label="Business profile" complete={profileComplete} href="/app/business" />
              <CloseStep label="Financial dataset" complete={activeDatasets > 0} href="/app/accountancy" />
              <CloseStep label="Tax context" complete={profileComplete} href="/app/accountancy/tax" />
            </div>
          </Card>

          <Card className="p-5 bg-card border-border">
            <h2 className="text-sm font-semibold text-foreground mb-3">Financial overview</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Connect financial data for bookkeeping, tax calculations, and reporting.
            </p>
            <div className="space-y-2">
              <Link href="/app/accountancy/reporting" className="block text-sm text-primary hover:underline">
                Monthly reporting dashboard
              </Link>
              <Link href="/app/accountancy/tax" className="block text-sm text-primary hover:underline">
                Tax calculation tools
              </Link>
              <Link href="/app/accountancy/compliance" className="block text-sm text-primary hover:underline">
                Compliance checklist
              </Link>
            </div>
          </Card>

          <Card className="p-5 bg-card border-border">
            <h2 className="text-sm font-semibold text-foreground mb-3">Quick actions</h2>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload financial CSV or Excel files here, or send invoices and receipts to Pre-bookkeeping.
              </p>
              <Link
                href="/app/prebookkeeping"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Open Pre-bookkeeping
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </aside>
  )

  return (
    <DashboardSubpageLayout
      title="Accountancy"
      description="Keep bookkeeping records, tax checks, and monthly reporting in one accounting workspace."
      breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Accountancy" }]}
      icon={BookOpenCheck}
      rightSidebar={rightSidebar}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/app/accountancy">
            <span className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
              <Upload className="h-4 w-4" />
              Upload financial data
            </span>
          </Link>
          <Link href="/app/accountancy/compliance">
            <span className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Review close
            </span>
          </Link>
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-6">
        <div className="max-w-6xl mx-auto space-y-5">
          <Card className="border-primary/30 bg-primary/5 p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpenCheck className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Accountancy workspace</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Upload accounting CSV or Excel files for bookkeeping review, tax checks, and monthly reporting.
                  Invoices, receipts, and bank exports stay in the dedicated Pre-bookkeeping workflow.
                </p>
                {!profileLoadFailed && !profileComplete && (
                  <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                    Complete your Business Profile first for accurate tax categorization and fiscal year alignment.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="border-border bg-card p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">Business Profile context</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Bookkeeping uses saved setup values for tax country, currency, fiscal year, VAT/sales tax, payroll, and
                fixed-cost assumptions.
              </p>
            </div>
            {profileLoadFailed ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Could not load Business Profile.
              </div>
            ) : (
              <div className="grid gap-2 text-sm">
                <ProfileContextRow label="Tax country" value={taxCountry} />
                <ProfileContextRow label="Currency" value={currency} />
                <ProfileContextRow label="Fiscal year" value={taxPeriod} />
                <ProfileContextRow label="VAT/sales tax" value={taxSummary} />
                <ProfileContextRow label="Payroll" value={payrollSummary} />
                <ProfileContextRow label="Fixed costs" value={fixedCostSummary} />
              </div>
            )}
            {!profileLoadFailed && !profileComplete && (
              <Link href="/app/business/setup" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
                Complete Business Profile Setup
              </Link>
            )}
          </Card>

          <AccountancyUpload datasetType="accountancy" />

          {focusedDataset && (
            <Card className="border-cyan-400/25 bg-cyan-400/5 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
                    Routed accountancy dataset
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">{focusedDataset.name || focusedDataset.fileName}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    This upload is saved in Accountancy so financial review stays separate from Profitability, Retail, Pre-bookkeeping, and the main Dashboard.
                  </p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-80">
                  <ProfileContextRow label="Rows" value={focusedDataset.rowCount.toLocaleString()} />
                  <ProfileContextRow label="Columns" value={focusedDataset.columnCount.toLocaleString()} />
                  <ProfileContextRow label="Category" value={getFocusedDatasetCategory(focusedDataset)} />
                  <ProfileContextRow label="Status" value="Ready for accounting review" />
                </div>
              </div>
              <ProfitabilityMetricGrid metrics={focusedDataset.precomputedMetrics} />
            </Card>
          )}

          <Card id="bookkeeping-package" className="border-border bg-card p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">Bookkeeping package</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add accountant details, confirm the tax period from your Business Profile, export the package, or prepare
                an email handoff.
              </p>
            </div>
            <AccountancyPackageForm
              initialCompanyName={companyName}
              initialTaxPeriod={taxPeriod === MISSING_BUSINESS_PROFILE_VALUE ? "" : taxPeriod}
              packageReady={activeDatasets > 0}
              profileContext={profileContextRows}
            />
          </Card>

          <DataTable
            title="Bookkeeping queue"
            description="Current bookkeeping work with direct links to the next action."
            emptyMessage="No bookkeeping tasks available."
            rows={bookkeepingRows}
            columns={bookkeepingColumns}
            rowKey={(row) => String(row.id)}
            minWidth="min-w-[760px]"
            selectable
          />
        </div>
      </div>
    </DashboardSubpageLayout>
  )
}

function ProfileContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[12rem] text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

function getFocusedDatasetCategory(dataset: { datasetType?: string | null; analysis: unknown }) {
  const category = resolveDatasetType(dataset.datasetType, dataset.analysis)
  return getDatasetCategoryLabel(category)
}

function ProfitabilityMetricGrid({ metrics }: { metrics: unknown }) {
  if (!metrics || typeof metrics !== "object") return null

  const values = metrics as Record<string, unknown>
  const metricCards = [
    { label: "Revenue", value: formatAccountancyMoney(values.totalRevenue) },
    { label: "Expenses", value: formatAccountancyMoney(values.totalExpenses) },
    { label: "Profit", value: formatAccountancyMoney(values.profit) },
    { label: "Margin", value: formatAccountancyPercent(values.margin) },
  ].filter((metric) => metric.value !== "No data")

  if (metricCards.length === 0) return null

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metricCards.map((metric) => (
        <div key={metric.label} className="rounded-lg border border-border bg-background/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
          <p className="mt-2 text-xl font-semibold text-foreground">{metric.value}</p>
        </div>
      ))}
    </div>
  )
}

function formatAccountancyMoney(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return "No data"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}

function formatAccountancyPercent(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return "No data"
  return `${value.toFixed(1)}%`
}

function CloseStep({ label, complete, href }: { label: string; complete: boolean; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 transition hover:border-primary/50 hover:bg-muted"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CheckCircle2 className={`h-4 w-4 ${complete ? "text-green-500" : "text-amber-500"}`} />
        {label}
      </span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {complete ? "Ready" : "Open"}
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}

const bookkeepingColumns: DataTableColumn<Record<string, unknown>>[] = [
  {
    key: "title",
    header: "Bookkeeping area",
    render: (row) => (
      <div>
        <Link href={String(row.href)} className="font-medium text-foreground transition hover:text-primary">
          {String(row.title)}
        </Link>
        <div>
          <Link href={String(row.href)} className="text-xs text-primary hover:underline">
            Open
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">{String(row.description)}</p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-medium text-foreground">
        {String(row.status)}
      </span>
    ),
  },
  {
    key: "action",
    header: "Action",
    align: "right",
    render: (row) => (
      <Link href={String(row.href)} className="text-xs font-medium text-primary hover:underline">
        Continue
      </Link>
    ),
  },
]
