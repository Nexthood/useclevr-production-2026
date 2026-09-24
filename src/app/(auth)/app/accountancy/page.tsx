import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { Card } from "@/components/ui/card"
import { getAccountingContext } from "@/lib/accountancy/accounting-context"
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
  try {
    return await AccountancyPageContent({ searchParams })
  } catch (error) {
    console.error("[ACCOUNTANCY] Server loader failed.", {
      file: "src/app/(auth)/app/accountancy/page.tsx",
      function: "AccountancyPageContent",
      error: serializeAccountancyError(error),
    })
    return <AccountancyEmptyState />
  }
}

async function AccountancyPageContent({ searchParams }: AccountancyPageProps) {
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

  const profileComplete = !profileLoadFailed && getSetupCompleted(companySetup)
  const accountingContext = getAccountingContext(companySetup)
  const sharedBusinessProfile = businessProfileResult.profile ?? {
    taxCountry: null,
    currency: null,
    fiscalYear: null,
    vatSalesTax: null,
    payroll: null,
    fixedCosts: null,
  }
  const taxPeriod = displayBusinessProfileValue(accountingContext.fiscalPeriod ?? sharedBusinessProfile.fiscalYear)
  const taxCountry = displayBusinessProfileValue(accountingContext.country ?? sharedBusinessProfile.taxCountry)
  const currency = displayBusinessProfileValue(accountingContext.currency ?? sharedBusinessProfile.currency)
  const legalStructure = displayBusinessProfileValue(accountingContext.legalStructure)
  const taxSystem = displayBusinessProfileValue(accountingContext.taxSystem ?? sharedBusinessProfile.vatSalesTax)
  const vatRegistered = formatBooleanProfileValue(accountingContext.vatRegistered)
  const defaultVatRate = formatRateProfileValue(accountingContext.defaultVatRate)
  const businessType = displayBusinessProfileValue(accountingContext.businessType ?? accountingContext.industry)
  const payrollSummary = displayBusinessProfileValue(sharedBusinessProfile.payroll)
  const fixedCostSummary = displayBusinessProfileValue(sharedBusinessProfile.fixedCosts)

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
                Upload accounting CSV, Excel, or PDF files in the Pre-bookkeeping workspace, then review financial
                datasets, tax context, and reporting here.
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
                  Accountancy is the financial overview hub: accounting datasets, tax context, monthly reporting, and
                  compliance tools. Upload accounting CSV, Excel, or PDF files in the Pre-bookkeeping workspace; saved
                  accounting datasets stay available here for financial review.
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
                Bookkeeping uses saved setup values for country, currency, legal structure, tax system, VAT status, fiscal period, and business type.
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
                <ProfileContextRow label="Legal structure" value={legalStructure} />
                <ProfileContextRow label="Fiscal year" value={taxPeriod} />
                <ProfileContextRow label="Tax system" value={taxSystem} />
                <ProfileContextRow label="VAT registered" value={vatRegistered} />
                <ProfileContextRow label="Default VAT rate" value={defaultVatRate} />
                <ProfileContextRow label="Business type" value={businessType} />
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
                  <ProfileContextRow label="Rows" value={formatAccountancyCount(focusedDataset.rowCount)} />
                  <ProfileContextRow label="Columns" value={formatAccountancyCount(focusedDataset.columnCount)} />
                  <ProfileContextRow label="Category" value={getFocusedDatasetCategory(focusedDataset)} />
                  <ProfileContextRow label="Status" value="Ready for accounting review" />
                </div>
              </div>
              <ProfitabilityMetricGrid metrics={focusedDataset.precomputedMetrics} />
            </Card>
          )}
        </div>
      </div>
    </DashboardSubpageLayout>
  )
}

function AccountancyEmptyState() {
  return (
    <DashboardSubpageLayout
      title="Accountancy"
      description="Keep bookkeeping records, tax checks, and monthly reporting in one accounting workspace."
      breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Accountancy" }]}
      icon={BookOpenCheck}
    >
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-6">
        <div className="mx-auto max-w-6xl space-y-5">
          <Card className="border-primary/30 bg-primary/5 p-6">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <BookOpenCheck className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">Accountancy workspace</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Accountancy is ready. Open Pre-bookkeeping to upload accounting CSV, Excel, or PDF files; this workspace
                keeps the financial overview, tax context, and reporting.
              </p>
              <Link
                href="/app/prebookkeeping"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Open Pre-bookkeeping
              </Link>
            </div>
          </Card>

          <Card className="border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-foreground">No Accountancy data yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              First-time workspaces load with an empty state instead of blocking the page. Add a financial dataset to populate this workspace.
            </p>
          </Card>
        </div>
      </div>
    </DashboardSubpageLayout>
  )
}

function ProfileContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[12rem] min-w-0 break-words text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

function getFocusedDatasetCategory(dataset: { datasetType?: string | null; analysis: unknown }) {
  const category = resolveDatasetType(dataset.datasetType, dataset.analysis)
  return getDatasetCategoryLabel(category)
}

function getSetupCompleted(setup: unknown) {
  if (!setup || typeof setup !== "object") return false
  const setupStatus = (setup as { setupStatus?: unknown }).setupStatus
  if (!setupStatus || typeof setupStatus !== "object") return false
  return Boolean((setupStatus as { completed?: unknown }).completed)
}

function formatAccountancyCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString()
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed.toLocaleString()
  }
  return "0"
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

function formatBooleanProfileValue(value: boolean | null) {
  if (value === true) return "Yes"
  if (value === false) return "No"
  return MISSING_BUSINESS_PROFILE_VALUE
}

function formatRateProfileValue(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return MISSING_BUSINESS_PROFILE_VALUE
  return `${value}%`
}

function serializeAccountancyError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return { message: String(error) }
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
