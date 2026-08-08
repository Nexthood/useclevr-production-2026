import { auth } from "@/lib/auth/auth"
import { getCreditAccount, getTransactionLedger, exportUsageCsv } from "@/lib/billing/credit-account-service"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get("limit") || 50)
  const offset = Number(searchParams.get("offset") || 0)
  const transactionType = searchParams.get("transactionType") || undefined
  const feature = searchParams.get("feature") || undefined
  const source = searchParams.get("source") || undefined
  const fromDate = searchParams.get("fromDate") ? new Date(searchParams.get("fromDate")!) : undefined
  const toDate = searchParams.get("toDate") ? new Date(searchParams.get("toDate")!) : undefined
  const format = searchParams.get("format")

  try {
    if (format === "csv") {
      const csv = await exportUsageCsv(userId, {
        limit: 1000,
        offset: 0,
        transactionType,
        feature,
        source,
        fromDate,
        toDate,
      })

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="useclevr-usage-${userId}-${new Date().toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      })
    }

    const account = await getCreditAccount(userId)
    const transactions = await getTransactionLedger(userId, {
      limit,
      offset,
      transactionType,
      feature,
      source,
      fromDate,
      toDate,
    })

    return NextResponse.json({
      account: account
        ? {
            includedBalance: account.includedBalance,
            purchasedBalance: account.purchasedBalance,
            totalAvailableBalance: account.totalAvailableBalance,
            totalPaidCents: account.totalPaidCents,
            remainingCredits: account.remainingCredits,
            creditsResetAt: account.creditsResetAt.toISOString(),
            tier: account.tier,
          }
        : null,
      transactions,
      pagination: {
        limit,
        offset,
        count: transactions.length,
      },
    })
  } catch (error) {
    console.error("[LEDGER] Error:", error)
    return NextResponse.json({ error: "Failed to fetch ledger" }, { status: 500 })
  }
}
