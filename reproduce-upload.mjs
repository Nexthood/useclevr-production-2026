const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Create test CSV files
const revenueCSV = `month,revenue_category,revenue
2026-01,Product Sales,5000
2026-01,Services,3000
2026-02,Product Sales,6000
2026-02,Services,4000`

const expenseCSV = `month,expense_category,expense
2026-01,COGS,2000
2026-01,Rent,1000
2026-02,COGS,2500
2026-02,Rent,1000`

fs.writeFileSync('/tmp/revenue.csv', revenueCSV)
fs.writeFileSync('/tmp/expense.csv', expenseCSV)

// First, let's test the API directly with a session cookie
// We need to get a session first. Let's check if there's a test auth helper.
console.log("CSV files created at /tmp/revenue.csv and /tmp/expense.csv")
console.log("\nRevenue CSV:")
console.log(revenueCSV)
console.log("\nExpense CSV:")
console.log(expenseCSV)
