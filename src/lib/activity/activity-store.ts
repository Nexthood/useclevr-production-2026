import { getDb } from "@/lib/db";
import { userActivities } from "@/lib/db/schema";
import { debugWarn } from "@/lib/utils/debug";
import { and, desc, eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export type ProductActivityType =
  | "register"
  | "login"
  | "profile_updated"
  | "business_updated"
  | "subscribed"
  | "dataset_uploaded"
  | "dataset_analyzed"
  | "dataset_deleted";

export type ProductActivity = typeof userActivities.$inferSelect;

type RecordActivityInput = {
  userId: string;
  userEmail?: string | null;
  type: ProductActivityType;
  feature: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

const MAX_USER_ACTIVITIES = 100;
const FEED_ACTIVITY_TYPES: ProductActivityType[] = [
  "register",
  "profile_updated",
  "business_updated",
  "subscribed",
  "dataset_uploaded",
  "dataset_analyzed",
  "dataset_deleted",
];

export async function recordActivity(input: RecordActivityInput): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    // De-duplicate: skip if same type + feature occurred within 1 hour
    const recent = await db.query.userActivities.findFirst({
      where: and(
        eq(userActivities.userId, input.userId),
        eq(userActivities.type, input.type),
        eq(userActivities.feature, input.feature),
        // Using GT for createdAt comparison would require datetime operations
      ),
      orderBy: [desc(userActivities.createdAt)],
    });

    if (recent) {
      const timeDiff = Date.now() - new Date(recent.createdAt).getTime();
      if (timeDiff < 60 * 60 * 1000) {
        // Skip duplicate within 1 hour
        return;
      }
    }

    await db.insert(userActivities).values({
      id: `act_${Date.now()}_${uuidv4().slice(0, 8)}`,
      userId: input.userId,
      userEmail: input.userEmail ?? null,
      type: input.type,
      feature: input.feature,
      title: input.title,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
    });

    await pruneUserActivities(input.userId);
  } catch (error) {
    debugWarn("Activity logging skipped:", error);
  }
}

export async function listUserActivities(
  userId: string,
  limit = MAX_USER_ACTIVITIES,
): Promise<ProductActivity[]> {
  const db = getDb();
  if (!db) return [];

  return db.query.userActivities.findMany({
    where: and(
      eq(userActivities.userId, userId),
      inArray(userActivities.type, FEED_ACTIVITY_TYPES),
    ),
    orderBy: [desc(userActivities.createdAt)],
    limit: clampLimit(limit),
  });
}

export async function listAllActivities(limit = MAX_USER_ACTIVITIES): Promise<ProductActivity[]> {
  const db = getDb();
  if (!db) return [];

  return db.query.userActivities.findMany({
    where: inArray(userActivities.type, FEED_ACTIVITY_TYPES),
    orderBy: [desc(userActivities.createdAt)],
    limit: clampLimit(limit),
  });
}

async function pruneUserActivities(userId: string) {
  const db = getDb();
  if (!db) return;

  const stale = await db.query.userActivities.findMany({
    where: eq(userActivities.userId, userId),
    columns: { id: true },
    orderBy: [desc(userActivities.createdAt)],
    offset: MAX_USER_ACTIVITIES,
  });

  if (stale.length === 0) return;

  await db.delete(userActivities).where(
    inArray(
      userActivities.id,
      stale.map((item) => item.id),
    ),
  );
}

function clampLimit(limit: number) {
  if (!Number.isFinite(limit)) return MAX_USER_ACTIVITIES;
  return Math.max(1, Math.min(MAX_USER_ACTIVITIES, Math.floor(limit)));
}
