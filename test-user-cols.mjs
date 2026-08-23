import { calculateProfitabilityAnalysis } from './src/lib/profitability/two-file-analysis.ts'

const result = calculateProfitabilityAnalysis({
  analysisId: "pa_test_user_cols",
  revenueFile: {
    role: "revenue",
    name: "revenue.csv",
    columns: ["month", "revenue_category", "revenue"],
    rows: [
      { month: "2026-01", revenue_category: "Product Sales", revenue: 5000 },
      { month: "2026-01", revenue_category: "Services", revenue: 3000 },
    ],
  },
  expensesFile: {
    role: "expenses",
    name: "expenses.csv",
    columns: ["month", "expense_category", "expense"],
    rows: [
      { month: "2026-01", expense_category: "COGS", expense: 2000 },
      { month: "2026-01", expense_category: "Rent", expense: 1000 },
    ],
  },
})

console.log(JSON.stringify(result, null, 2))
