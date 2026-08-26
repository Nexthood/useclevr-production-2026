import { POST } from "./src/app/api/reports/route"

async function main() {
  const mockRequest = {
    json: async () => ({
      datasetId: "pa_profitability_test",
      timezone: "UTC",
      timezoneOffset: 0,
    }),
    headers: {
      get: (key: string) => {
        if (key === "idempotency-key") return "test-profitability-report"
        return null
      },
    },
  } as any as Request

  try {
    console.log("Calling API route...")
    const response = await POST(mockRequest)
    const text = await response.text()
    console.log("Response status:", response.status)
    console.log("Response body:", text)
  } catch (error) {
    console.error("API FAILED:", error instanceof Error ? error.message : String(error))
    if (error instanceof Error) {
      console.error("Stack:", error.stack)
    }
    process.exit(1)
  }
}

main()
