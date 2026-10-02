/**
 * One-off generator for the permanent alternative-structure golden fixtures.
 * Writes scripts/analysis/fixtures/alternative_structure_{revenue,expenses}_test.csv
 * with arithmetic-exact totals:
 *   revenue net 72,450.00 (sales 73,300.00 - discounts 850.00)
 *   expenses net 28,975.50 (spend 29,000.00 - tax 24.50)
 */
import * as fs from "fs"
import * as path from "path"

const round2 = (value: number) => Math.round(value * 100) / 100
const fmt = (value: number) => round2(value).toFixed(2)

function solveLastRow(partialSum: number, target: number): { quantity: number; unit: number } {
  for (let quantity = 2; quantity <= 40; quantity += 1) {
    const needed = target - partialSum
    if (needed > 0 && needed % quantity === 0 && needed / quantity >= 1500 && needed / quantity <= 250000) {
      return { quantity, unit: needed / quantity }
    }
  }
  throw new Error(`No clean last row: partialSum=${partialSum} target=${target}`)
}

const revenuePlans: Array<[number, number, number]> = [
  [12, 8950, 2500], [4, 15250, 0], [30, 1100, 1250], [7, 24250, 3000],
  [18, 6400, 0], [9, 16800, 8500], [22, 4250, 0],
  [6, 26100, 4000], [15, 9100, 0], [11, 13250, 5000],
  [8, 17950, 2500], [25, 5700, 0], [10, 14500, 0],
  [16, 8300, 4000], [5, 26400, 0], [13, 10050, 7500], [7, 18500, 0],
  [21, 6800, 3500], [4, 33320, 0], [17, 8900, 2500],
]

const targetNetRevenue = 7245000
const targetDiscount = 85000
let netRevenue = 0
let discountTotal = 0
for (const [quantity, unit, discount] of revenuePlans) {
  netRevenue += quantity * unit
  discountTotal += discount
}
const revenueLast = solveLastRow(netRevenue, targetNetRevenue)
revenuePlans.push([revenueLast.quantity, revenueLast.unit, targetDiscount - discountTotal])

const revenueLines = ["date,product,quantity,unit_price,sales_value,discount_value"]
revenuePlans.forEach((plan, index) => {
  const [quantity, unitPrice, discount] = plan
  const net = quantity * unitPrice
  revenueLines.push([
    `2025-${String((index % 5) + 7).padStart(2, "0")}-${String((index % 27) + 1).padStart(2, "0")}`,
    ["Starter", "Growth", "Scale"][index % 3],
    quantity,
    fmt(unitPrice / 100),
    fmt((net + discount) / 100),
    fmt(discount / 100),
  ].join(","))
})

const expensePlans: Array<[number, number, number, string, string]> = [
  [1, 485000, 1225, "Rent", "Workspace GmbH"],
  [1, 420000, 0, "Payroll", "Payroll Co"],
  [6, 12250, 425, "Software", "Cloud Plus"],
  [3, 21500, 0, "Marketing", "AdNetwork"],
  [12, 9500, 100, "Software", "Cloud Plus"],
  [1, 310000, 0, "Utilities", "CityGrid"],
  [4, 18500, 0, "Travel", "TravelHub"],
  [9, 16000, 500, "Payroll", "Payroll Co"],
  [2, 74000, 0, "Rent", "Workspace GmbH"],
  [5, 20100, 0, "Marketing", "AdNetwork"],
  [8, 14750, 200, "Utilities", "CityGrid"],
  [1, 166050, 0, "Professional Fees", "Legal Partner"],
]

const targetNetExpense = 2897550
const targetTax = 2450
let netExpense = 0
let taxTotal = 0
for (const [quantity, unit, tax] of expensePlans) {
  netExpense += quantity * unit
  taxTotal += tax
}
const expenseLast = solveLastRow(netExpense, targetNetExpense)
const taxRemainder = targetTax - taxTotal
expensePlans.push([expenseLast.quantity, expenseLast.unit, taxRemainder, "Insurance", "Shield AG"])

const expenseLines = ["date,vendor,cost_type,quantity,unit_cost,spend_value,tax_value"]
expensePlans.forEach((plan, index) => {
  const [quantity, unitCost, tax, costType, vendor] = plan
  const net = quantity * unitCost
  expenseLines.push([
    `2025-${String((index % 5) + 7).padStart(2, "0")}-${String((index % 27) + 1).padStart(2, "0")}`,
    vendor,
    costType,
    quantity,
    fmt(unitCost / 100),
    fmt((net + tax) / 100),
    fmt(tax / 100),
  ].join(","))
})

const fixturesDir = path.join(process.cwd(), "scripts/analysis/fixtures")
fs.writeFileSync(path.join(fixturesDir, "alternative_structure_revenue_test.csv"), revenueLines.join("\n") + "\n")
fs.writeFileSync(path.join(fixturesDir, "alternative_structure_expenses_test.csv"), expenseLines.join("\n") + "\n")

const checkRevenueNet = revenuePlans.reduce((total, plan) => total + plan[0] * plan[1], 0)
const checkRevenueDiscount = revenuePlans.reduce((total, plan) => total + plan[2], 0)
const checkExpenseNet = expensePlans.reduce((total, plan) => total + plan[0] * plan[1], 0)
const checkTax = expensePlans.reduce((total, plan) => total + plan[2], 0)
console.log(JSON.stringify({
  revenueNet: checkRevenueNet / 100,
  revenueDiscount: checkRevenueDiscount / 100,
  revenueGross: (checkRevenueNet + checkRevenueDiscount) / 100,
  expenseNet: checkExpenseNet / 100,
  tax: checkTax / 100,
  spend: (checkExpenseNet + checkTax) / 100,
  expenseLastRow: { ...expenseLast, taxRemainder },
  revenueLastRow: { ...revenueLast, discount: targetDiscount - discountTotal },
}))
