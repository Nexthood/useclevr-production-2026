import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

async function requireSuperAdmin() {
  const session = await auth()
  return session?.user?.role === "superadmin"
}

export async function GET() {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const db = getDb()
  if (!db) {
    return NextResponse.json({ customers: [] })
  }

  try {
    const rows = await db
      .select({
        id: profiles.userId,
        name: profiles.fullName,
        email: profiles.email,
     plan: profiles.subscriptionTier,
        planStatus: profiles.stripeStatus,
        signupDate: profiles.createdAt,
        businessName: profiles.businessName,
      })
      .from(profiles)
      .orderBy(desc(profiles.createdAt))

    const customers = rows.map((r) => ({
      id: r.id,
      name: r.name || r.businessName || "—",
      email: r.email || "—",
      plan: r.plan || "free",
      planStatus: r.planStatus || "active",
      signupDate: r.signupDate ? new Date(r.signupDate).toISOString() : null,
      lastLogin: null,
      referralSource: null,
      loginCount: 0,
      datasets: 0,
    }))

    return NextResponse.json({ customers })
  } catch (err) {
    console.error("[admin/customers] error:", err)
    return NextResponse.json({ error: "Failed to load customers" }, { status: 500 })
  }
}
