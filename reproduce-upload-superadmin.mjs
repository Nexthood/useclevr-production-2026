import { uploadCSV } from './src/app/actions/upload.ts'

const revenueCSV = `month,revenue_category,revenue
2026-01,Product Sales,5000
2026-01,Services,3000`

const expenseCSV = `month,expense_category,expense
2026-01,COGS,2000
2026-01,Rent,1000`

function createFormData(fileRole, fileContent, fileName) {
  const formData = new FormData()
  const file = new File([fileContent], fileName, { type: 'text/csv' })
  
  formData.append('file', file)
  formData.append('uploadMode', 'profitability')
  formData.append('dataset_type', 'profitability')
  formData.append('profitability_analysis_id', 'pa_test_123')
  formData.append('profitability_file_role', fileRole)
  formData.append('profitabilityFileRole', fileRole)
  formData.append('fileType', fileRole === 'revenue' ? 'profitability_revenue' : 'profitability_expenses')
  
  const stats = {
    profitabilityAnalysisId: 'pa_test_123',
    status: 'waiting_for_expenses',
    hasRevenue: true,
    hasExpenses: false,
    totalRevenue: 0,
    totalExpenses: 0,
    cogs: null,
    operatingExpenses: null,
    interestExpense: null,
    taxExpense: null,
    grossProfit: null,
    operatingProfit: null,
    netProfit: null,
    profit: null,
    grossMargin: null,
    operatingMargin: null,
    netMargin: null,
    margin: null,
    expenseCategories: [],
    topCostCategories: [],
    revenueByProduct: [],
    revenueByRegion: [],
    revenueByMonth: {},
    metricSources: {},
    periodTrends: [],
    departmentComparison: [],
    matchKey: null,
    missingColumns: [],
    unavailableMetrics: ['grossProfit', 'operatingProfit', 'netProfit', 'grossMargin', 'operatingMargin', 'netMargin'],
    dataConfidence: 85,
    dataQualityNotes: ['No shared period + department, company_id, or cost_center key was detected; totals are combined without row-level matching.'],
    sourceFiles: [
      { role: 'revenue', name: 'revenue.csv', rowCount: 2, columns: ['month', 'revenue_category', 'revenue'] },
      { role: 'expenses', name: 'expenses.csv', rowCount: 2, columns: ['month', 'expense_category', 'expense'] },
    ],
    hasBothFiles: false,
    fileRole: fileRole,
    statusLabel: 'Waiting for Expenses file',
    profitabilityFileRole: fileRole,
    profitability_analysis_id: 'pa_test_123',
  }
  
  formData.append('profitabilityData', JSON.stringify(stats))
  formData.append('revenueColumns', JSON.stringify(['month', 'revenue_category', 'revenue']))
  formData.append('revenueRowCount', '2')
  formData.append('expenseColumns', JSON.stringify(['month', 'expense_category', 'expense']))
  formData.append('expenseRowCount', '2')
  
  return formData
}

async function main() {
  console.log("=== Testing Revenue Upload (superadmin) ===")
  try {
    const result = await uploadCSV(createFormData('revenue', revenueCSV, 'revenue.csv'))
    console.log("Revenue upload result:", JSON.stringify(result, null, 2))
  } catch (error) {
    console.error("Revenue upload exception:", error)
    console.error("Stack:", error.stack)
  }
}

main()
