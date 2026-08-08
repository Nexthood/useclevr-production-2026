import { auth } from "@/lib/auth/auth"
import { getActiveCreditTopUpPackages, getCreditTopUpPackageById } from "@/lib/billing/credit-packages"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { createCreditTopUpCheckoutSession } from "@/services/stripe/credit-checkout"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const packages = getActiveCreditTopUpPackages()

  return NextResponse.json({
    packages: packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      creditsGranted: pkg.creditsGranted,
      monetaryAmount: pkg.monetaryAmountCents / 100,
      currency: pkg.currency,
      pricingVersion: pkg.pricingVersion,
      stripeAvailable: Boolean(pkg.providers.stripe),
      squareAvailable: Boolean(pkg.providers.square),
    })),
  })
}

export async function POST(request: Request) {
  const session = await auth()
  const user = session?.user

  if (!user?.id || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const packageId = typeof body.packageId === "string" ? body.packageId : undefined
  const provider = (typeof body.provider === "string" ? body.provider : "stripe") as "stripe" | "square"
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : undefined

  const creditPackage = packageId
    ? getCreditTopUpPackageById(packageId)
    : null

  if (!creditPackage || !creditPackage.active) {
    return NextResponse.json(
      { error: "Invalid or inactive credit package" },
      { status: 400 },
    )
  }

  if (!creditPackage.providers[provider]) {
    return NextResponse.json(
      { error: `Credit package not available for ${provider}` },
      { status: 400 },
    )
  }

  if (creditPackage.currency !== (body.currency as string | undefined) && body.currency) {
    return NextResponse.json(
      { error: "Currency does not match the selected package" },
      { status: 400 },
    )
  }

  if (provider !== "stripe" && provider !== "square") {
    return NextResponse.json(
      { error: "Unsupported payment provider" },
      { status: 400 },
    )
  }

  const origin = new URL(request.url).origin

  if (provider === "stripe") {
    const stripePriceId = creditPackage.providers.stripe
    if (!stripePriceId) {
      return NextResponse.json(
        { error: "Stripe checkout is not configured for this package" },
        { status: 503 },
      )
    }

    const successUrl = `${origin}/app/settings/subscription?tab=billing&topup=success`
    const cancelUrl = `${origin}/app/settings/subscription?tab=billing&topup=cancel`

    try {
      const checkout = await createCreditTopUpCheckoutSession({
        userId: user.id,
        userEmail: user.email,
        customerId: await getUserStripeCustomerId(user.id),
        stripePriceId,
        expectedCurrency: creditPackage.currency,
        successUrl,
        cancelUrl,
        metadata: {
          userId: user.id,
          workspaceId: workspaceId || user.id,
          creditPackageId: creditPackage.id,
          pricingVersion: creditPackage.pricingVersion,
          creditsGranted: String(creditPackage.creditsGranted),
          monetaryAmountCents: String(creditPackage.monetaryAmountCents),
          currency: creditPackage.currency,
        },
      })

      return NextResponse.json({
        success: true,
        provider: "stripe",
        checkoutUrl: checkout.url,
        checkoutId: checkout.id,
        package: {
          id: creditPackage.id,
          name: creditPackage.name,
          creditsGranted: creditPackage.creditsGranted,
          monetaryAmount: creditPackage.monetaryAmountCents / 100,
          currency: creditPackage.currency,
        },
        status: "pending_webhook",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create checkout session"
      const code =
        error instanceof Error && "code" in error
          ? (error as { code: string }).code
          : "checkout_session_failed"
      return NextResponse.json(
        { error: message, code },
        { status: 500 },
      )
    }
  }

  if (provider === "square") {
    return NextResponse.json(
      { error: "Square credit top-up checkout is not yet available via this endpoint. Use Stripe." },
      { status: 501 },
    )
  }

  return NextResponse.json({ error: "Unsupported provider" }, { status: 400 })
}

async function getUserStripeCustomerId(userId: string): Promise<string | null> {
  const db = getDb()
  if (!db) return null

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { stripeCustomerId: true },
  })

  return profile?.stripeCustomerId ?? null
}
