import { desc, eq, inArray } from "drizzle-orm";
import {
  partnerApplications,
  partnerAccounts,
  partnerContracts,
  partnerContractAudit,
  partnerContractDeliveries,
  partnerContractProfiles,
  partnerContractSchedules,
} from "@/lib/db/schema";
import { ContractError, requireOwner, runtimePolicy, hashObject, featureEnabled } from "./domain";
import { contractDatabase, registerCatalog, currentFinancialConfig } from "./records";
import { contractRow, liveGates } from "./lifecycle";
import { readArtifact } from "./storage";
export function ownerAllowed(id: string) {
  try {
    requireOwner(id);
    return true;
  } catch {
    return false;
  }
}
export async function contractView(userId: string, admin = false) {
  const db = contractDatabase();
  if (!featureEnabled())
    return {
      enabled: false,
      applications: [],
      contracts: [],
      profiles: [],
      schedules: [],
      templates: [],
      owner: false,
    };
  if (admin) await registerCatalog(db);
  const applications = await db.query.partnerApplications.findMany({
    where: admin ? undefined : eq(partnerApplications.linkedUserId, userId),
    orderBy: desc(partnerApplications.createdAt),
    limit: 500,
  });
  const ids = applications.map((a) => a.id);
  const [contracts, profiles, schedules, templates] = await Promise.all([
    ids.length
      ? db.query.partnerContracts.findMany({
          where: inArray(partnerContracts.applicationId, ids),
          orderBy: desc(partnerContracts.createdAt),
        })
      : [],
    ids.length
      ? db.query.partnerContractProfiles.findMany({
          where: inArray(partnerContractProfiles.applicationId, ids),
          orderBy: desc(partnerContractProfiles.version),
        })
      : [],
    ids.length
      ? db.query.partnerContractSchedules.findMany({
          where: inArray(partnerContractSchedules.applicationId, ids),
          orderBy: desc(partnerContractSchedules.createdAt),
        })
      : [],
    admin ? db.query.partnerContractTemplates.findMany() : [],
  ]);
  const rows = await Promise.all(
    contracts.map(async (c) => {
      const p = await db.query.partnerAccounts.findFirst({
        where: eq(partnerAccounts.id, c.partnerId),
      });
      let ready = false;
      if (c.status === "fully_executed" && c.mode === "dropbox_live")
        try {
          await liveGates(db, c);
          ready = true;
        } catch {}
      const audit = admin
        ? await db.query.partnerContractAudit.findMany({
            where: eq(partnerContractAudit.contractId, c.id),
            orderBy: desc(partnerContractAudit.createdAt),
            limit: 500,
          })
        : [];
      const deliveries = admin
        ? await db.query.partnerContractDeliveries.findMany({
            where: eq(partnerContractDeliveries.contractId, c.id),
          })
        : [];
      return {
        id: c.id,
        applicationId: c.applicationId,
        partnerId: c.partnerId,
        revision: c.revision,
        agreementType: c.agreementType,
        templateVersion: c.templateVersion,
        commercialTermsVersion: c.commercialTermsVersion,
        mode: c.mode,
        status: c.status,
        partnerStatus: p?.status || "pending",
        readyForActivation: ready,
        partnerSignedAt: c.partnerSignedAt,
        companySignedAt: c.companySignedAt,
        executedAt: c.executedAt,
        expiresAt: c.expiresAt,
        lastErrorCode: c.lastErrorCode,
        sourceAvailable: !!c.sourceArtifactId,
        signedAvailable: !!c.signedArtifactId,
        auditAvailable: !!c.auditArtifactId,
        documentChecksum: c.documentChecksum,
        signedDocumentChecksum: c.signedDocumentChecksum,
        ...(admin
          ? {
              audit,
              deliveries: deliveries.map(
                ({ id, kind, recipientRole, status, attempts, lastErrorCode, sentAt }) => ({
                  id,
                  kind,
                  recipientRole,
                  status,
                  attempts,
                  lastErrorCode,
                  sentAt,
                }),
              ),
            }
          : {}),
      };
    }),
  );
  const policy = runtimePolicy();
  return {
    enabled: true,
    owner: admin && ownerAllowed(userId),
    applications: applications.map(
      ({ id, fullName, status, onboardedAt, partnerAccountId, category }) => ({
        id,
        fullName,
        status,
        onboardedAt,
        partnerAccountId,
        category,
      }),
    ),
    contracts: rows,
    profiles,
    schedules,
    templates,
    ...(admin
      ? {
          runtime: { policy, checksum: hashObject(policy) },
          financialConfig: await currentFinancialConfig(db),
        }
      : {}),
  };
}
export async function privateContractDocument(
  id: string,
  kind: string,
  userId: string,
  admin: boolean,
) {
  const db = contractDatabase(),
    c = await contractRow(db, id);
  if (!admin) {
    const app = await db.query.partnerApplications.findFirst({
      where: eq(partnerApplications.id, c.applicationId),
    });
    if (
      c.snapshot.userId !== userId ||
      app?.linkedUserId !== userId ||
      app.partnerAccountId !== c.partnerId
    )
      throw new ContractError("document_not_found", 404);
  }
  if (!["source", "signed", "audit"].includes(kind))
    throw new ContractError("document_not_found", 404);
  if (kind === "audit" && !admin) throw new ContractError("document_not_found", 404);
  const artifactId =
    kind === "source"
      ? c.sourceArtifactId
      : kind === "signed"
        ? c.signedArtifactId
        : c.auditArtifactId;
  const checksum =
    kind === "source"
      ? c.documentChecksum
      : kind === "signed"
        ? c.signedDocumentChecksum
        : c.auditEvidenceChecksum;
  if (!artifactId || !checksum) throw new ContractError("document_not_found", 404);
  return readArtifact(db, artifactId, c.id, checksum);
}
