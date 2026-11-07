import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { referralCodeOwners, referralStats } from "@/lib/db/schema";

export async function getAccountReferralCode(userId: string, email?: string | null) {
  const db = getDb();
  if (!db) throw new Error("Database unavailable.");
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`referral-owner:${userId}`},0))`,
    );
    const existing = await tx.query.referralCodeOwners.findFirst({
      where: eq(referralCodeOwners.userId, userId),
    });
    if (existing) {
      const owner = await tx.query.referralStats.findFirst({
        where: eq(referralStats.code, existing.code),
      });
      if (owner?.ownerUserId !== userId)
        throw new Error("Referral ownership requires administrator review.");
      return existing.code;
    }
    const code = `uc-${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    await tx.insert(referralStats).values({ code, ownerUserId: userId, ownerEmail: email || null });
    await tx.insert(referralCodeOwners).values({ userId, code });
    return code;
  });
}
