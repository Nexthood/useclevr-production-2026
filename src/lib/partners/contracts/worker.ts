import { randomUUID } from "node:crypto";
import { and, eq, lte, sql } from "drizzle-orm";
import {
  partnerContracts,
  partnerContractJobs,
  partnerContractDeliveries,
  partnerContractWebhooks,
} from "@/lib/db/schema";
import { ContractError, requireFeature, terminalStates, runtimePolicy } from "./domain";
import { contractDatabase, enqueueJob, enqueueReadyApplications, contractAudit } from "./records";
import {
  prepareContract,
  sendContract,
  reconcileContract,
  remindContract,
  cancelContract,
} from "./lifecycle";
import { deliverContractEmail } from "./mail";
import { verifyDropboxCallback } from "./provider";
export async function acceptDropboxWebhook(
  json: string,
  header: string | null,
): Promise<{ accepted: boolean; duplicate?: boolean; setup?: boolean }> {
  requireFeature();
  const e = verifyDropboxCallback(json, header);
  if (!e.reference) return { accepted: true, setup: true };
  return contractDatabase().transaction(async (tx) => {
    const inserted = await tx
      .insert(partnerContractWebhooks)
      .values({
        id: randomUUID(),
        eventKey: e.eventKey,
        providerReference: e.reference!,
        eventType: e.eventType,
        eventTime: e.eventTime,
        bodyChecksum: e.bodyChecksum,
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) return { accepted: true, duplicate: true };
    const c = await tx.query.partnerContracts.findFirst({
      where: eq(partnerContracts.providerReference, e.reference!),
    });
    if (c && !terminalStates.includes(c.status))
      await enqueueJob(tx, "reconcile", `reconcile:${c.id}`, { contractId: c.id }, true);
    return { accepted: true };
  });
}
export async function scanContractWork() {
  const db = contractDatabase();
  await enqueueReadyApplications(db);
  const active = await db.query.partnerContracts.findMany({
    where: sql`${partnerContracts.status} not in ('fully_executed','cancelled','expired','rejected') and ${partnerContracts.mode}<>'draft'`,
    limit: 1000,
  });
  for (const c of active) {
    if (c.providerReference || ["sending", "send_uncertain"].includes(c.status))
      await enqueueJob(db, "reconcile", `reconcile:${c.id}`, { contractId: c.id });
    if (
      c.providerReference &&
      Date.now() - c.createdAt.getTime() > runtimePolicy().reminderHours * 3600000
    )
      await enqueueJob(db, "remind", `remind:${c.id}`, { contractId: c.id });
  }
}
export async function runContractWorker(limit = 2, scan = true) {
  requireFeature();
  const db = contractDatabase();
  if (scan) await scanContractWork();
  let processed = 0;
  for (let i = 0; i < Math.min(5, Math.max(1, limit)); i++) {
    const job = await db.transaction(async (tx) => {
      const ids = await tx.execute(
        sql`select id from "PartnerContractJob" where (status='pending' and "nextAttemptAt"<=now()) or (status='running' and "leaseUntil"<now()) order by "nextAttemptAt","createdAt" for update skip locked limit 1`,
      );
      const id = ids.rows[0]?.id as string | undefined;
      if (!id) return null;
      const [row] = await tx
        .update(partnerContractJobs)
        .set({
          status: "running",
          leaseUntil: new Date(Date.now() + 180000),
          attempts: sql`${partnerContractJobs.attempts}+1`,
        })
        .where(eq(partnerContractJobs.id, id))
        .returning();
      return row;
    });
    if (!job) break;
    try {
      if (job.kind === "prepare") await prepareContract(job.applicationId!);
      else if (job.kind === "send") await sendContract(job.contractId!);
      else if (job.kind === "reconcile") await reconcileContract(job.contractId!);
      else if (job.kind === "remind") await remindContract(job.contractId!);
      else if (job.kind === "cancel")
        await cancelContract(
          job.contractId!,
          "system",
          "Persisted administrator cancellation request",
        );
      else throw new ContractError("unknown_job_kind");
      await db
        .update(partnerContractJobs)
        .set({ status: "done", leaseUntil: null, lastErrorCode: null })
        .where(eq(partnerContractJobs.id, job.id));
    } catch (e) {
      const code = e instanceof ContractError ? e.code : "contract_job_failed";
      const failedContract = job.contractId
        ? await db.query.partnerContracts.findFirst({
            where: eq(partnerContracts.id, job.contractId),
          })
        : null;
      const uncertain =
        job.kind === "send" &&
        !!failedContract &&
        ["sending", "send_uncertain"].includes(failedContract.status);
      await db
        .update(partnerContractJobs)
        .set({
          status: uncertain ? "uncertain" : job.attempts >= 10 ? "failed" : "pending",
          leaseUntil: null,
          lastErrorCode: code,
          nextAttemptAt: new Date(
            Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7)),
          ),
        })
        .where(eq(partnerContractJobs.id, job.id));
    }
    processed++;
  }
  const due = await db.query.partnerContractDeliveries.findMany({
    where: and(
      lte(partnerContractDeliveries.nextAttemptAt, new Date()),
      sql`${partnerContractDeliveries.status}='pending' or (${partnerContractDeliveries.status}='sending' and ${partnerContractDeliveries.leaseUntil}<now())`,
    ),
    limit: 5,
  });
  for (const d of due) await deliverContractEmail(d.id);
  return { processed, deliveries: due.length };
}
export async function recoverAbsentRequest(
  id: string,
  actor: string,
  reason: string,
  confirmed: boolean,
) {
  if (!confirmed || reason.trim().length < 15)
    throw new ContractError("provider_absence_review_confirmation_required", 400);
  const db = contractDatabase();
  const c = await db.query.partnerContracts.findFirst({ where: eq(partnerContracts.id, id) });
  if (!c || !["send_uncertain", "sending"].includes(c.status) || c.providerReference)
    throw new ContractError("uncertain_creation_required");
  if (Date.now() - c.updatedAt.getTime() < 180000)
    throw new ContractError("wait_for_inflight_provider_creation_to_finish");
  const { requireOwner } = await import("./domain");
  requireOwner(actor);
  const { contractProvider } = await import("./lifecycle");
  if (await contractProvider(db, c).find(c.id))
    throw new ContractError("provider_request_exists_reconcile_instead");
  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from "PartnerContract" where id=${id} for update`);
    const current = await tx.query.partnerContracts.findFirst({
      where: eq(partnerContracts.id, id),
    });
    if (
      !current ||
      current.providerReference ||
      !["send_uncertain", "sending"].includes(current.status)
    )
      throw new ContractError("contract_state_changed");
    await contractAudit(tx, actor, "provider_absence_confirmed", reason, {
      contractId: id,
      evidence: { explicitOwnerReview: true },
    });
    await tx
      .update(partnerContracts)
      .set({ status: "generated", lastErrorCode: null })
      .where(eq(partnerContracts.id, id));
    await tx
      .update(partnerContractJobs)
      .set({ status: "pending", attempts: 0, nextAttemptAt: new Date(), lastErrorCode: null })
      .where(eq(partnerContractJobs.key, `send:${id}`));
  });
  return { retryQueued: true };
}
