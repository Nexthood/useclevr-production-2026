import { auth } from "@/lib/auth/auth"
import { getCreditAccount, addPurchasedCredits } from "@/lib/billing/credit-account-service"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      amount,
      monetaryAmountCents,
      currency = "EUR",
      paymentProvider,
      providerTransactionId,
      paymentStatus = "pending",
      source = "payment_provider",
      metadata = {},
    } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid credit amount" }, { status: 400 })
    }

    if (!monetaryAmountCents || monetaryAmountCents <= 0) {
      return NextResponse.json({ error: "Invalid monetary amount" }, { status: 400 })
    }

    if (!paymentProvider || !providerTransactionId) {
      return NextResponse.json({ error: "Payment provider and transaction ID are required" }, { status: 400 })
    }

    const existing = await getCreditAccount(userId)
    if (!existing) {
      return NextResponse.json({ error: "Credit account not found" }, { status: 404 })
    }

    const updatedAccount = await addPurchasedCredits({
      userId,
      amount,
      monetaryAmountCents,
      currency,
      paymentProvider,
      providerTransactionId,
      paymentStatus,
      source,
      metadata,
    })

    if (!updatedAccount) {
      return NextResponse.json({ error: "Failed to add purchased credits" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      account: {
        includedBalance: updatedAccount.includedBalance,
        purchasedBalance: updatedAccount.purchasedBalance,
        totalAvailableBalance: updatedAccount.totalAvailableBalance,
        totalPaidCents: updatedAccount.totalPaidCents,
        remainingCredits: updatedAccount.remainingCredits,
      },
    })
  } catch (error) {
    console.error("[PURCHASE_CREDITS] Error:", error)
    return NextResponse.json({ error: "Failed to process purchase" }, { status: 500 })
  }
}
