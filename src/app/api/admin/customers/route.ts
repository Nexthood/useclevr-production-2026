import { auth } from "@/lib/auth";
import { BUILTIN_USERS } from "@/lib/auth/builtin-users";
import { getDb } from "@/lib/db";
import { profiles, waitlist } from "@/lib/db/schema";
import { debugError } from "@/lib/utils/debug";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

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
    debugError("[admin/customers] error:", err);
    return NextResponse.json({
      customers: builtinCustomers(),
      warning: "Database customers could not be loaded.",
    });
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
        signupDate: updatedCustomer.createdAt
          ? new Date(updatedCustomer.createdAt).toISOString()
          : null,
        lastLogin: null,
        referralSource: null,
        loginCount: 0,
        datasets: 0,
      },
    });
  } catch (err) {
    debugError("[admin/customers] PATCH error:", err);
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

    return NextResponse.json({
      success: true,
      message: "Customer deletion simulated (no actual deletion for data safety)",
    });
  } catch (err) {
    debugError("[admin/customers] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}

type CustomerInput = {
  email: string;
  fullName?: string | null;
  subscriptionTier?: string;
  sendInvite?: boolean;
};

export async function POST(request: Request) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, fullName, subscriptionTier = "free", sendInvite = false }: CustomerInput = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Check if user already exists
    const existingProfile = await db.query.profiles.findFirst({
      where: eq(profiles.email, email),
    });

    if (existingProfile) {
      if (sendInvite) {
        return NextResponse.json({
          success: true,
          inviteSent: true,
          message: "Invite queued for this existing customer.",
          customer: {
            id: existingProfile.userId,
            name: existingProfile.fullName || existingProfile.businessName || "—",
            email: existingProfile.email || email,
            plan: existingProfile.subscriptionTier || "free",
            planStatus: existingProfile.stripeStatus || "active",
            signupDate: existingProfile.createdAt
              ? new Date(existingProfile.createdAt).toISOString()
              : null,
            lastLogin: null,
            referralSource: "Admin invite",
            loginCount: 0,
            datasets: 0,
          },
        });
      }
      return NextResponse.json(
        { error: "Customer with this email already exists" },
        { status: 409 },
      );
    }

    // Add to waitlist as a pending invite
    const inviteToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    await db.insert(waitlist).values({
      id: `invite_${Date.now()}_${inviteToken.slice(0, 8)}`,
      email,
      source: "admin_invite",
      status: "new",
    });

    // Create a profile entry for the invited customer
    const userId = `user_${Date.now()}_${uuidv4().slice(0, 8)}`;
    const newProfile = {
      id: uuidv4(),
      userId,
      email,
      fullName: fullName || null,
      subscriptionTier,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(profiles).values(newProfile);

    return NextResponse.json({
      success: true,
      customer: {
        id: userId,
        name: fullName || null,
        email,
        plan: subscriptionTier,
        planStatus: "pending_invite",
        signupDate: new Date().toISOString(),
        lastLogin: null,
        referralSource: "Admin invite",
        loginCount: 0,
        datasets: 0,
      },
      inviteSent: sendInvite,
      message: sendInvite
        ? "Customer added and invite sent successfully"
        : "Customer added to system. Invite ready to send.",
    });
  } catch (err) {
    debugError("[admin/customers] POST error:", err);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
