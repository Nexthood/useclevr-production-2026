export type ClevrSyncPlanTier = "free" | "pro" | "business" | "admin" | "superadmin" | string;

export type ClevrSyncEntitlement = {
  enabled: boolean;
  tier: string;
  connectors: {
    googleSheets: boolean;
    oneDrive: false;
    sharePoint: false;
    scheduledSync: false;
  };
  upgradeRequired: boolean;
  upgradeHref: string;
};

const PAID_CLEVRSYNC_TIERS = new Set(["pro", "business", "admin", "superadmin"]);

export function getClevrSyncEntitlement(input: {
  subscriptionTier?: ClevrSyncPlanTier | null;
  unlimited?: boolean | null;
}): ClevrSyncEntitlement {
  const tier = String(input.subscriptionTier || "free").toLowerCase();
  const enabled = Boolean(input.unlimited) || PAID_CLEVRSYNC_TIERS.has(tier);

  return {
    enabled,
    tier,
    connectors: {
      googleSheets: enabled,
      oneDrive: false,
      sharePoint: false,
      scheduledSync: false,
    },
    upgradeRequired: !enabled,
    upgradeHref: "/app/settings/checkout?plan=pro_monthly&discount=auto",
  };
}
