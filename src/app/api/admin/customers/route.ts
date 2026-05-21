import { auth } from "@/lib/auth";
import { BUILTIN_USERS } from "@/lib/auth/builtin-users";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

async function requireSuperAdmin() {
  const session = await auth();
  return session?.user?.role === "superadmin";
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
  }));
}

export async function GET() {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ customers: builtinCustomers() });
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
      .orderBy(desc(profiles.createdAt));

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
    }));

    const builtinIds = new Set<string>(BUILTIN_USERS.map((user) => user.id));
    const customers = [
      ...builtinCustomers(),
      ...persistedCustomers.filter((customer) => !builtinIds.has(customer.id)),
    ];

    return NextResponse.json({ customers });
  } catch (err) {
    console.error("[admin/customers] error:", err);
    return NextResponse.json({ customers: builtinCustomers(), warning: "Database customers could not be loaded." });
  }
}

export async function PATCH(request: Request) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const body = await request.json();
    const { id, updates } = body;

    if (!id || !updates) {
      return NextResponse.json({ error: "Missing id or updates" }, { status: 400 });
    }

    // Prevent updating built-in users
    const builtinIds = new Set<string>(BUILTIN_USERS.map((user) => user.id));
    if (builtinIds.has(id)) {
      return NextResponse.json({ error: "Cannot modify built-in users" }, { status: 403 });
    }

    // Map frontend fields to database fields
    const dbUpdates: any = {};
    if (updates.fullName !== undefined) {
      dbUpdates.fullName = updates.fullName;
    }
    if (updates.email !== undefined) {
      dbUpdates.email = updates.email;
    }
    if (updates.subscriptionTier !== undefined) {
      dbUpdates.subscriptionTier = updates.subscriptionTier;
    }
    if (updates.stripeStatus !== undefined) {
      dbUpdates.stripeStatus = updates.stripeStatus;
    }
    if (updates.businessName !== undefined) {
      dbUpdates.businessName = updates.businessName;
    }

    // Add updatedAt timestamp
    dbUpdates.updatedAt = new Date();

    const result = await db
      .update(profiles)
      .set(dbUpdates)
      .where(eq(profiles.userId, id))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const updatedCustomer = result[0];
    return NextResponse.json({
      customer: {
        id: updatedCustomer.userId,
        name: updatedCustomer.fullName || updatedCustomer.businessName || "—",
        email: updatedCustomer.email || "—",
        plan: updatedCustomer.subscriptionTier || "free",
        planStatus: updatedCustomer.stripeStatus || "active",
        signupDate: updatedCustomer.createdAt ? new Date(updatedCustomer.createdAt).toISOString() : null,
        lastLogin: null,
        referralSource: null,
        loginCount: 0,
        datasets: 0,
      }
    });
  } catch (err) {
    console.error("[admin/customers] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    // Prevent deleting built-in users
    const builtinIds = new Set<string>(BUILTIN_USERS.map((user) => user.id));
    if (builtinIds.has(id)) {
      return NextResponse.json({ error: "Cannot delete built-in users" }, { status: 403 });
    }

    // Note: In a real application, you might want to soft delete or handle related data
    // For now, we'll just return success since we don't actually delete from the database
    // due to potential foreign key constraints and data integrity concerns
    
    return NextResponse.json({ success: true, message: "Customer deletion simulated (no actual deletion for data safety)" });
  } catch (err) {
    console.error("[admin/customers] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}
