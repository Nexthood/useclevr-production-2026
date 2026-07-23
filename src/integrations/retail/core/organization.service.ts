import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { listUserBusinesses } from "@/lib/business/business-store";

export async function requirePrimaryRetailOrganization(userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database connection is unavailable.");

  const existing = await listUserBusinesses(userId);
  const primary = existing.find((business) => business.isPrimary) || existing[0];
  if (!primary?.id || primary.id === "profile-primary") {
    throw new Error("Create a business profile before connecting a retail integration.");
  }
  return primary.id;
}

export async function assertOrganizationMembership(userId: string, organizationId: string) {
  const db = getDb();
  if (!db) throw new Error("Database connection is unavailable.");
  const [row] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.id, organizationId), eq(businesses.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Retail organization access denied.");
}
