import { and, desc, eq, lte } from "drizzle-orm";
import { partnerContracts, partnerConfigs } from "@/lib/db/schema";
import { featureEnabled, hashObject, isLiveMode } from "./contracts/domain";
import type { ContractDb } from "./contracts/types";

/** Rates and eligibility policies belong to the immutable financial configuration signed by this partner. */
export async function signedFinancialConfig(db: ContractDb, partnerId: string, at = new Date()) {
  if (!featureEnabled()) return null;
  const c = await db.query.partnerContracts.findFirst({
    where: and(eq(partnerContracts.partnerId, partnerId), lte(partnerContracts.createdAt, at)),
    orderBy: [desc(partnerContracts.createdAt), desc(partnerContracts.revision)],
  });
  if (
    !c ||
    !isLiveMode(c.mode) ||
    c.status !== "fully_executed" ||
    !c.verifiedAt ||
    !c.executedAt ||
    c.executedAt > at ||
    !c.partnerSignedAt ||
    !c.companySignedAt ||
    !c.providerReference ||
    !c.signedArtifactId ||
    !c.signedDocumentChecksum ||
    !c.auditArtifactId ||
    !c.auditEvidenceChecksum ||
    !c.providerSnapshot?.complete ||
    (c.snapshot.effectiveUntil && Date.parse(c.snapshot.effectiveUntil) <= at.getTime())
  )
    return null;
  if (c.mode === "native") await (await import("./contracts/native")).verifyNativeExecution(db, c);
  const config = await db.query.partnerConfigs.findFirst({
    where: eq(partnerConfigs.id, c.snapshot.financialConfigId),
  });
  if (
    !config ||
    config.effectiveAt > at ||
    hashObject(config.config) !== c.snapshot.financialConfigHash
  )
    return null;
  const rates = c.snapshot.commissionRatesBps;
  return {
    contractId: c.id,
    config: rates
      ? {
          ...config,
          config: { ...config.config, standardBps: rates.standard, premiumBps: rates.premium },
        }
      : config,
  };
}
