import { uploadCSV } from './src/app/actions/upload.ts'

// Mock FormData
function createFormData() {
  const formData = new FormData()
  
  const revenueCSV = `month,revenue_category,revenue
2026-01,Product Sales,5000
2026-01,Services,3000`
  
  const expenseCSV = `month,expense_category,expense
2026-01,COGS,2000
2026-01,Rent,1000`
  
  const revenueFile = new File([revenueCSV], 'revenue.csv', { type: 'text/csv' })
  const expenseFile = new File([expenseCSV], 'expenses.csv', { type: 'text/csv' })
  
  // First upload revenue
  formData.append('file', revenueFile)
  formData.append('uploadMode', 'profitability')
  formData.append('dataset_type', 'profitability')
  formData.append('profitability_analysis_id', 'pa_test_123')
  formData.append('profitability_file_role', 'revenue')
  formData.append('profitabilityData', JSON.stringify({
    profitabilityAnalysisId: 'pa_test_123',
    status: 'waiting_for_expenses',
    hasRevenue: true,
    hasExpenses: false,
    totalRevenue: 8000,
    sourceFiles: [{ role: 'revenue', name: 'revenue.csv', rowCount: 2, columns: ['month', 'revenue_category', 'revenue'] }]
  }))
  formData.append('revenueColumns', JSON.stringify(['month', 'revenue_category', 'revenue']))
  formData.append('revenueRowCount', '2')
  
  return formData
}

async function main() {
  console.log("Testing server upload action directly...")
  try {
    const result = await uploadCSV(createFormData())
    console.log("Result:", JSON.stringify(result, null, 2))
  } catch (error) {
    console.error("Exception:", error)
    console.error("Stack:", error.stack)
  }
}

main()
