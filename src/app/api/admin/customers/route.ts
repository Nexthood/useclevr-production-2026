import { auth } from "@/lib/auth";
import { BUILTIN_USERS } from "@/lib/auth/builtin-users";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

async function requireSuperAdmin() {
  const session = await auth()
  return session?.user?.role === "superadmin"
}

function builtinCustomers() {
  return BUILTIN_USERS.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.role === "superadmin" ? "superadmin" : "free",
    planStatus: "static",
    signupDate: null,
    lastLogin: null,
    referralSource: "Built-in account",
    loginCount: 0,
    datasets: 0,
  }))
}

export async function GET() {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const db = getDb()
    if (!db) {
      return NextResponse.json({ customers: builtinCustomers() })
    }

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

    const persistedCustomers = rows.map((r) => ({
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

    const builtinIds = new Set<string>(BUILTIN_USERS.map((user) => user.id))
    const customers = [
      ...builtinCustomers(),
      ...persistedCustomers.filter((customer) => !builtinIds.has(customer.id)),
    ]

    return NextResponse.json({ customers })
  } catch (err) {
    console.error("[admin/customers] error:", err)
    return NextResponse.json({ customers: builtinCustomers(), warning: "Database customers could not be loaded." })
  }
}
