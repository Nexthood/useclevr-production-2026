import { debugLog, debugError } from "../../src/lib/debug"

// Test script for CSV analyzer
import { analyzeCSV, DatasetRecord } from '../../src/lib/csv-analyzer'

// Sample test data
const testData: DatasetRecord[] = [
  { order_date: '2025-01-01', product: 'Widget X', revenue: 150.00, quantity: 2, country: 'DE', customer_id: '1001', is_return: false },
  { order_date: '2025-01-02', product: 'Widget Y', revenue: 89.99, quantity: 1, country: 'US', customer_id: '1002', is_return: true },
  { order_date: '2025-01-03', product: 'Widget X', revenue: 150.00, quantity: 3, country: 'DE', customer_id: '1001', is_return: false },
  { order_date: '2025-01-04', product: 'Phone Case', revenue: 29.99, quantity: 5, country: 'FR', customer_id: '1003', is_return: false },
]

// Run analysis (async for FX rate fetching)
async function runTest() {
  debugLog('Running CSV analysis...\n')
  const result = await analyzeCSV(testData)

  // Output result as formatted JSON
  debugLog(JSON.stringify(result, null, 2))
}

runTest().catch(debugError)
