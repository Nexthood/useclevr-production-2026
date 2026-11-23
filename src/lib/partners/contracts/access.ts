import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import {
  partnerApplications,
  partnerAccounts,
  partnerContracts,
  partnerContractAudit,
  partnerContractDeliveries,
  partnerContractNativeInvitations,
  partnerContractProfiles,
  partnerContractSchedules,
} from "@/lib/db/schema";
import {
  ContractError,
  isLiveMode,
  requireOwner,
  runtimePolicy,
  hashObject,
  featureEnabled,
} from "./domain";
import { contractDatabase, registerCatalog, currentFinancialConfig } from "./records";
import { contractRow, liveGates, type ContractRow } from "./lifecycle";
import { readArtifact } from "./storage";
import type { ContractDb } from "./types";

async function partnerSigningAvailability(db: ContractDb, contract: ContractRow) {
  const c = contract;
  if (
    c.partnerSignedAt ||
    !["generated", "sending", "send_uncertain", "sent", "awaiting_partner_signature"].includes(
      c.status,
    )
  )
    return undefined;
  if (c.expiresAt <= new Date()) return "invitation_unavailable";
  if (!isLiveMode(c.mode)) {
    if (c.lastErrorCode && c.lastErrorCode !== "live_provider_configuration_not_approved")
      return "approval_pending";
    return "disabled";
  }

  try {
    await liveGates(db, c);
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    return error.code === "live_provider_configuration_not_approved"
      ? "disabled"
      : "approval_pending";
  }

  if (c.status === "send_uncertain") return "delivery_issue";
  if (c.mode === "dropbox_live")
    return c.providerReference && ["sent", "awaiting_partner_signature"].includes(c.status)
      ? "invitation_ready"
      : "invitation_pending";
  if (c.status !== "awaiting_partner_signature" || !c.documentChecksum) return "invitation_pending";

  const invitations = partnerContractNativeInvitations;
  const invitation = await db.query.partnerContractNativeInvitations.findFirst({
    columns: { id: true },
    where: and(
      eq(invitations.contractId, c.id),
      eq(invitations.role, "partner"),
      eq(invitations.email, c.snapshot.partnerEmail.toLowerCase()),
      eq(invitations.documentChecksum, c.documentChecksum),
      gt(invitations.expiresAt, new Date()),
      isNull(invitations.usedAt),
      isNull(invitations.revokedAt),
    ),
  });
  if (!invitation) return "invitation_unavailable";

  const delivery = await db.query.partnerContractDeliveries.findFirst({
    columns: { status: true },
    where: and(
      eq(partnerContractDeliveries.contractId, c.id),
      eq(partnerContractDeliveries.kind, `native_invitation:${invitation.id}`),
      eq(partnerContractDeliveries.recipientRole, "partner"),
    ),
  });
  if (delivery?.status === "sent") return "invitation_ready";
  if (!delivery || ["failed", "uncertain"].includes(delivery.status)) return "delivery_issue";
  return "invitation_pending";
}
export function ownerAllowed(id: string) {
  try {
    requireOwner(id);
    return true;
  } catch {
    return false;
  }
}
export async function contractView(userId: string, admin = false, applicationId?: string) {
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
    where: admin
      ? undefined
      : and(
          eq(partnerApplications.linkedUserId, userId),
          applicationId ? eq(partnerApplications.id, applicationId) : undefined,
        ),
    orderBy: desc(partnerApplications.createdAt),
    limit: 500,
  });
  const ids = applications.map((a) => a.id);
  const [contracts, profiles, schedules, templates] = await Promise.all([
    ids.length
      ? db.query.partnerContracts.findMany({
          where: inArray(partnerContracts.applicationId, ids),
          orderBy: [desc(partnerContracts.createdAt), desc(partnerContracts.revision)],
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
  const latestContractIds = new Map<string, string>();
  for (const contract of contracts) {
    if (!latestContractIds.has(contract.applicationId))
      latestContractIds.set(contract.applicationId, contract.id);
  }
  const rows = await Promise.all(
    contracts.map(async (c) => {
      const p = await db.query.partnerAccounts.findFirst({
        where: eq(partnerAccounts.id, c.partnerId),
      });
      let ready = false;
      if (c.status === "fully_executed" && isLiveMode(c.mode))
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
        ...(!admin && latestContractIds.get(c.applicationId) === c.id
          ? { signingAvailability: await partnerSigningAvailability(db, c) }
          : {}),
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
  applicationId?: string,
) {
  const db = contractDatabase(),
    c = await contractRow(db, id);
  if (applicationId && c.applicationId !== applicationId)
    throw new ContractError("document_not_found", 404);
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
  if (c.mode === "native" && kind !== "source")
    await (await import("./native")).verifyNativeExecution(db, c);
  return readArtifact(db, artifactId, c.id, checksum);
}
