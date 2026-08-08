import { auth } from "@/lib/auth/auth"
import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { getCreditAccount, addPurchasedCredits } from "@/lib/billing/credit-account-service"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId || !isSuperAdminUserId(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const raw = body as Record<string, unknown>
    const amount = typeof raw.amount === "number" ? raw.amount : NaN
    const monetaryAmountCents = typeof raw.monetaryAmountCents === "number" ? raw.monetaryAmountCents : NaN
    const currency = typeof raw.currency === "string" ? raw.currency : "EUR"
    const paymentProvider = typeof raw.paymentProvider === "string" ? raw.paymentProvider : ""
    const providerTransactionId = typeof raw.providerTransactionId === "string" ? raw.providerTransactionId : ""
    const paymentStatus = typeof raw.paymentStatus === "string" ? raw.paymentStatus : "finalized"
    const source = typeof raw.source === "string" ? raw.source : "payment_provider"
    const metadata = (raw.metadata && typeof raw.metadata === "object") ? (raw.metadata as Record<string, unknown>) : {}
    const targetUserId = typeof raw.targetUserId === "string" ? raw.targetUserId : undefined

    const effectiveUserId = targetUserId && targetUserId.trim().length > 0 ? targetUserId : userId

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid credit amount" }, { status: 400 })
    }

    if (!Number.isFinite(monetaryAmountCents) || monetaryAmountCents <= 0) {
      return NextResponse.json({ error: "Invalid monetary amount" }, { status: 400 })
    }

    if (!paymentProvider || !providerTransactionId) {
      return NextResponse.json({ error: "Payment provider and transaction ID are required" }, { status: 400 })
    }

    const existing = await getCreditAccount(effectiveUserId)
    if (!existing) {
      return NextResponse.json({ error: "Credit account not found" }, { status: 404 })
    }

    const updatedAccount = await addPurchasedCredits({
      userId: effectiveUserId,
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
