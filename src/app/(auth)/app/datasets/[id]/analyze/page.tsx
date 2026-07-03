import { debugLog } from "@/lib/utils/debug"

import { DatasetAnalyzer } from "@/components/dataset/dataset-analyzer"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth/auth"
import { findAccessibleDataset, loadDatasetData } from "@/lib/data/dataset-access"
import { getSetupStatus } from "@/lib/business/company-setup-store"
import { AlertTriangle, Sparkles, BriefcaseBusiness } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

// Type for analysis result (simplified for props)
type DatasetAnalyzerInitialAnalysis = Parameters<typeof DatasetAnalyzer>[0]["initialAnalysis"]

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return { title: "Analyze" }

  try {
    const { dataset } = await findAccessibleDataset(id, session.user.id, session.user.role)
    return { title: dataset ? `Analyze: ${dataset.name}` : "Analyze" }
  } catch {
    return { title: "Analyze" }
  }
}

export default async function AnalyzePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()
  const userId = (session?.user as { id?: string })?.id
  const userRole = session?.user?.role

  if (!userId) {
    notFound()
  }

  // Get business profile status
  const setupStatus = await getSetupStatus(userId)
  const profileCompletion = setupStatus?.setupAccuracy ?? 0
  const hasIncompleteProfile = profileCompletion < 80

  // Get dataset using Drizzle - read data directly from dataset.data column
  const { dataset } = await findAccessibleDataset(id, userId, userRole)

  if (!dataset) {
    notFound()
  }

  // Read rows from the data column in Dataset table (full dataset)
  const data = await loadDatasetData(id, dataset)
  const columns = getDatasetColumns(dataset.columns)
  // Use dataset.rowCount for total
  const rowCount = dataset.rowCount || data.length

  // Get column types from dataset record (stored during upload)
  const columnTypes = (dataset as { columnTypes?: Record<string, string> }).columnTypes || {}
  
  // Log for debugging
  debugLog('[DEBUG-PAGE] Dataset from DB:', { 
    id: dataset.id, 
    name: dataset.name,
    totalRowCount: rowCount,
    columnCount: columns.length
  })
  debugLog('[DEBUG-PAGE] Column types from database:', JSON.stringify(columnTypes))

  // Check if dataset already has analysis results (for state persistence)
  const hasAnalysis: boolean = Boolean(
    dataset.analysis && typeof dataset.analysis === 'object' && Object.keys(dataset.analysis as object).length > 0
  )
  const initialAnalysis = hasAnalysis ? (dataset.analysis as DatasetAnalyzerInitialAnalysis) : undefined
  
  debugLog('[DEBUG-PAGE] Dataset analysis status:', { 
    id: dataset.id, 
    name: dataset.name,
    hasAnalysis 
  })

  return (
    <div className="flex flex-col flex-1">
      <AppPageHeader
        title={`Analyze: ${dataset.name}`}
        description={hasAnalysis ? "View insights and ask questions" : "Analyze your dataset with AI"}
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Datasets", href: "/app/datasets" },
          { label: dataset.name },
          { label: "Analyze" },
        ]}
        icon={Sparkles}
      />

      {hasIncompleteProfile && (
        <div className="mb-4 px-4 sm:px-6">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold text-amber-950 dark:text-amber-100">
                    Business Profile Incomplete
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Tax, payroll, insurance, fixed costs, profitability, forecasting, and KPI calculations depend on Business Profile data.
                  </p>
                </div>
              </div>
              <Link href="/app/business">
                <Button size="sm" variant="outline" className="border-amber-500/40">
                  <BriefcaseBusiness className="mr-2 h-4 w-4" />
                  Complete ({profileCompletion}%)
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <DatasetAnalyzer
          datasetId={id}
          datasetName={dataset.name}
          columns={columns}
          data={data}
          rowCount={rowCount}
          isAnalyzed={hasAnalysis}
          initialAnalysis={initialAnalysis}
        />
      </main>
    </div>
  )
}

function getDatasetColumns(value: unknown) {
  return Array.isArray(value) ? value.filter((column): column is string => typeof column === "string") : []
}
