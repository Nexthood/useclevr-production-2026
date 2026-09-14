import "server-only";

import type { Session } from "next-auth";

import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits";
import { getClevrSyncEntitlement } from "@/services/clevrsync/entitlement";

export class ClevrSyncAccessError extends Error {
  readonly status = 403;
  readonly code = "CLEVRSYNC_UPGRADE_REQUIRED";

  constructor() {
    super("ClevrSync requires a Pro or Business plan.");
    this.name = "ClevrSyncAccessError";
  }
}

export async function getClevrSyncAccess(user?: Session["user"] | null) {
  const usage = await getAnalystCreditUsage(user?.id, user?.role, user?.email ?? null);
  return getClevrSyncEntitlement({
    subscriptionTier: usage.subscriptionTier,
    unlimited: usage.unlimited,
  });
}

export async function requireClevrSyncAccess(user?: Session["user"] | null) {
  const access = await getClevrSyncAccess(user);
  if (!access.enabled) throw new ClevrSyncAccessError();
  return access;
}

export function clevrSyncAccessErrorPayload(error: unknown) {
  if (error instanceof ClevrSyncAccessError) {
    return {
      error: error.message,
      code: error.code,
      upgradeRequired: true,
      upgradeHref: "/app/settings/checkout?plan=pro_monthly&discount=auto",
      status: error.status,
    };
  }
  return null;
}
