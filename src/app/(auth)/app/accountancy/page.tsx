import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { AccountancyPackageForm } from "@/components/accountancy/accountancy-package-form"
import { Card } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { auth } from "@/lib/auth/auth"
import { getCompanySetup } from "@/lib/business/company-setup-store"
import { getDb } from "@/lib/db"
import { businesses, datasets } from "@/lib/db/schema"
import { count, eq } from "drizzle-orm"
import {
  ArrowRight,
  Banknote,
  BookOpenCheck,
  Calculator,
  CheckCircle2,
  DollarSign,
  FileText,
  Landmark,
  MapPin,
  ReceiptText,
  Scale,
  Upload,
} from "lucide-react"
import Link from "next/link"
import type React from "react"

export const metadata = {
  title: "Accountancy - UseClevr",
}

export default async function AccountancyPage() {
  const session = await auth()
  const userId = session?.user?.id

  let activeDatasets = 0
  let totalBusinesses = 0
  const companySetup = userId ? await getCompanySetup(userId) : null

  if (userId) {
    const db = getDb()
    if (db) {
      try {
        const [countResult] = await db
          .select({ count: count() })
          .from(datasets)
          .where(eq(datasets.userId, userId))

        const [businessCount] = await db
          .select({ count: count() })
          .from(businesses)
          .where(eq(businesses.userId, userId))

        activeDatasets = (countResult?.count ?? 0) as number
        totalBusinesses = (businessCount?.count ?? 0) as number
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : "Could not load accountancy data.")
      }
    }
  }

  const readiness = Math.round((activeDatasets / Math.max(totalBusinesses, 1)) * 100)
  const hasAccountancyData = activeDatasets > 0
  const profileComplete = Boolean(companySetup?.setupStatus.completed)
  const companyName = companySetup?.companyInfo.companyName || ""
  const taxPeriod = [companySetup?.companyInfo.fiscalYearStart, companySetup?.companyInfo.fiscalYearEnd]
    .filter(Boolean)
    .join(" to ")
  const taxCountry = companySetup?.companyInfo.taxResidenceCountry || companySetup?.companyInfo.country || "Not set"
  const currency = companySetup?.currencySettings.primaryCurrency || "Not set"
  const taxSummary = companySetup?.taxSettings.taxEntries.length
    ? companySetup.taxSettings.taxEntries
      .map((tax) => `${tax.taxType}${tax.percentage ? ` ${tax.percentage}%` : ""}`)
      .join(", ")
    : companySetup?.taxSettings.taxType || "Not set"
  const payrollSummary = companySetup?.employerContributions.length
    ? companySetup.employerContributions.map((entry) => entry.contributionType).join(", ")
    : "Not set"
  const fixedCostSummary = companySetup?.fixedCosts.length
    ? companySetup.fixedCosts.map((entry) => entry.costCategory).join(", ")
    : "Not set"
  const profileContextRows = [
    { label: "Tax country", value: taxCountry },
    { label: "Currency", value: currency },
    { label: "Fiscal year", value: taxPeriod || "Not set" },
    { label: "VAT/sales tax", value: taxSummary },
    { label: "Payroll", value: payrollSummary },
    { label: "Fixed costs", value: fixedCostSummary },
  ]
  const workflowSteps = [
    { title: "Complete Business Profile Setup", complete: profileComplete, text: "Confirm company, tax, payroll, currency, fiscal year, and fixed-cost assumptions." },
    { title: "Upload accounting documents", complete: hasAccountancyData, text: "Add receipts, invoices, bank exports, PDFs, Excel, CSV, or images." },
    { title: "Extract and structure data", complete: hasAccountancyData, text: "Prepare rows for pre-bookkeeping review." },
    { title: "Create pre-bookkeeping summary", complete: hasAccountancyData, text: "Use uploaded data plus Business Profile context." },
    { title: "Export package", complete: hasAccountancyData, text: "Prepare PDF report, Excel file, and CSV file." },
    { title: "Send to accountant", complete: false, text: "Add accountant email and message before handoff." },
  ]
  const bookkeepingRows = [
    {
      id: "bank-reconciliation",
      title: "Bank reconciliation",
      description:
        activeDatasets > 0
          ? "Match imported statements against dataset totals."
          : "Upload a bank export to start matching statement rows.",
      status: activeDatasets > 0 ? "Ready" : "Needs data",
      href: "/app/upload",
    },
    {
      id: "expense-coding",
      title: "Expense coding",
      description: "Review uncategorised payments, supplier costs, and tax categories.",
      status: activeDatasets > 0 ? "Available" : "Needs data",
      href: "/app/accountancy/reporting",
    },
    {
      id: "monthly-close",
      title: "Monthly close",
      description:
        totalBusinesses > 0
          ? "Track close steps for business profiles with connected records."
          : "Add a business profile before closing monthly books.",
      status: totalBusinesses > 0 ? "Ready" : "Needs profile",
      href: totalBusinesses > 0 ? "/app/accountancy/compliance" : "/app/business",
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
              <CloseStep label="Business profile" complete={totalBusinesses > 0} href="/app/business" />
              <CloseStep label="Financial dataset" complete={activeDatasets > 0} href="/app/upload" />
              <CloseStep label="Tax context" complete={totalBusinesses > 0} href="/app/accountancy/tax" />
            </div>
          </Card>

          <Card className="p-5 bg-card border-border">
            <h2 className="text-sm font-semibold text-foreground mb-3">Financial overview</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Connect financial data for bookkeeping, tax calculations, and reporting.
            </p>
            <div className="space-y-2">
              <Link
                href="/app/accountancy/reporting"
                className="block text-sm text-primary hover:underline"
              >
                Monthly reporting dashboard
              </Link>
              <Link
                href="/app/accountancy/tax"
                className="block text-sm text-primary hover:underline"
              >
                Tax calculation tools
              </Link>
              <Link
                href="/app/accountancy/compliance"
                className="block text-sm text-primary hover:underline"
              >
                Compliance checklist
              </Link>
            </div>
          </Card>

          <Card className="p-5 bg-card border-border">
            <h2 className="text-sm font-semibold text-foreground mb-3">Quick actions</h2>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload receipts, invoices, bank exports, or accounting documents for pre-bookkeeping insights.
              </p>
              <Link
                href="/app/upload"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Upload document
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
          <Link href="/app/upload">
            <span className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
              <Upload className="h-4 w-4" />
              Upload document
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
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-6xl mx-auto space-y-5">
          {!hasAccountancyData && (
            <Card className="border-primary/30 bg-primary/5 p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpenCheck className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground">Pre-bookkeeping center</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Upload receipts, invoices, bank exports or accounting documents.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/app/upload">
                    <span className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                      <Upload className="h-4 w-4" />
                      Upload document
                    </span>
                  </Link>
                  <a href="#bookkeeping-package">
                    <span className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition hover:bg-muted">
                      <FileText className="h-4 w-4" />
                      Generate bookkeeping package
                    </span>
                  </a>
                </div>
              </div>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-800 dark:text-green-100" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalBusinesses}</p>
                  <p className="text-sm text-muted-foreground">Business profiles</p>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-800 dark:text-blue-100" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{activeDatasets}</p>
                  <p className="text-sm text-muted-foreground">Connected datasets</p>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-purple-800 dark:text-purple-100" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{readiness}%</p>
                  <p className="text-sm text-muted-foreground">Ready for analysis</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <Card className="border-border bg-card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Bookkeeping workspace</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Track bank reconciliation, expense coding, monthly close, and tax-ready records.
                  </p>
                </div>
                <BookOpenCheck className="h-5 w-5 flex-shrink-0 text-primary" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <BookkeepingFeature icon={Banknote} title="Cash movement" text="Review bank, card, revenue, and expense imports." />
                <BookkeepingFeature icon={ReceiptText} title="Receipts" text="Keep source documents tied to imported records." />
                <BookkeepingFeature icon={Scale} title="Reconciliation" text="Compare statement totals with uploaded business data." />
                <BookkeepingFeature icon={Calculator} title="Tax prep" text="Surface VAT, sales tax, and filing context from profile data." />
              </div>
            </Card>

            <Card className="border-border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">Business Profile context</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Accountancy uses saved setup values for tax country, currency, fiscal year, VAT/sales tax, payroll, and fixed-cost assumptions.
                </p>
              </div>
              <div className="grid gap-2 text-sm">
                <ProfileContextRow label="Tax country" value={taxCountry} />
                <ProfileContextRow label="Currency" value={currency} />
                <ProfileContextRow label="Fiscal year" value={taxPeriod || "Not set"} />
                <ProfileContextRow label="VAT/sales tax" value={taxSummary} />
                <ProfileContextRow label="Payroll" value={payrollSummary} />
                <ProfileContextRow label="Fixed costs" value={fixedCostSummary} />
              </div>
              {!profileComplete && (
                <Link href="/app/business/setup" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
                  Complete Business Profile Setup
                </Link>
              )}
            </Card>
          </div>

          <Card className="border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Pre-bookkeeping workflow</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Follow the flow from Business Profile setup through document upload, extraction, summary, export, and accountant handoff.
                </p>
              </div>
              <ReceiptText className="h-5 w-5 flex-shrink-0 text-primary" />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {workflowSteps.map((step, index) => (
                <div key={step.title} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">{index + 1}</span>
                    <CheckCircle2 className={`h-4 w-4 ${step.complete ? "text-green-500" : "text-muted-foreground"}`} />
                    {step.title}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{step.text}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card id="bookkeeping-package" className="border-border bg-card p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">Bookkeeping package</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add accountant details, confirm the company and tax period, export the package, or prepare an email handoff.
              </p>
            </div>
            <AccountancyPackageForm
              initialCompanyName={companyName}
              initialTaxPeriod={taxPeriod}
              packageReady={hasAccountancyData}
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
      <span className="max-w-[12rem] text-right font-medium text-foreground">{value || "Not set"}</span>
    </div>
  )
}

function BookkeepingFeature({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  text: string
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

function CloseStep({ label, complete, href }: { label: string; complete: boolean; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 transition hover:border-primary/50 hover:bg-muted">
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
