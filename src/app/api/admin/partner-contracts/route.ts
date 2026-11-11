import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/require-session";
import { validWriteOrigin } from "@/lib/partners/api";
import { ContractError, requireFeature, text } from "@/lib/partners/contracts/domain";
import { contractResponse, contractError, requestBody } from "@/lib/partners/contracts/http";
import { contractView } from "@/lib/partners/contracts/access";
import {
  reviewContractIdentity,
  createSchedule,
  approveVersion,
  revokeVersion,
  approveRuntime,
  enqueueJob,
  contractDatabase,
  contractAudit,
} from "@/lib/partners/contracts/records";
import { activateExecutedContract } from "@/lib/partners/contracts/activation";
import { prepareContract, advanceMock } from "@/lib/partners/contracts/lifecycle";
import { retryContractDelivery } from "@/lib/partners/contracts/mail";
import { runContractWorker, recoverAbsentRequest } from "@/lib/partners/contracts/worker";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.error;
  try {
    return contractResponse(await contractView(auth.userId, true));
  } catch (e) {
    return contractError(e);
  }
}
const command = z
  .object({
    action: z.enum([
      "prepare",
      "review_identity",
      "create_schedule",
      "approve_template",
      "approve_schedule",
      "revoke_template",
      "revoke_schedule",
      "approve_provider",
      "revoke_provider",
      "send",
      "reconcile",
      "remind",
      "cancel",
      "retry_email",
      "activate",
      "run",
      "recover_absent",
      "mock_partner",
      "mock_company",
      "mock_expire",
    ]),
    id: text(1, 150).optional(),
    checksum: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    reason: text(5, 1000).optional(),
    confirm: z.boolean().optional(),
    schedule: z.unknown().optional(),
  })
  .strict();
export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.error;
  try {
    requireFeature();
    if (!validWriteOrigin(request)) throw new ContractError("request_origin_not_verified", 403);
    const b = command.parse(await requestBody(request));
    const id = b.id || "";
    if (b.action !== "run" && !id) throw new ContractError("record_id_required", 400);
    let result: unknown;
    switch (b.action) {
      case "prepare":
        result = await prepareContract(id);
        break;
      case "review_identity":
        result = await reviewContractIdentity(auth.userId, id, b.reason || "");
        break;
      case "create_schedule":
        result = await createSchedule(auth.userId, id, b.schedule);
        break;
      case "approve_template":
      case "approve_schedule":
        result = await approveVersion(
          auth.userId,
          b.action === "approve_template" ? "template" : "schedule",
          id,
          b.checksum || "",
          b.reason || "",
          b.confirm === true,
        );
        break;
      case "revoke_template":
      case "revoke_schedule":
        result = await revokeVersion(
          auth.userId,
          b.action === "revoke_template" ? "template" : "schedule",
          id,
          b.reason || "",
        );
        break;
      case "approve_provider":
      case "revoke_provider":
        result = await approveRuntime(
          auth.userId,
          b.checksum || "",
          b.reason || "",
          b.confirm === true,
          b.action === "revoke_provider",
        );
        break;
      case "activate":
        result = await activateExecutedContract(
          id,
          auth.userId,
          b.reason || "",
          b.confirm === true,
        );
        break;
      case "retry_email":
        await retryContractDelivery(id, auth.userId);
        result = { queued: true };
        break;
      case "recover_absent":
        result = await recoverAbsentRequest(id, auth.userId, b.reason || "", b.confirm === true);
        break;
      case "run":
        result = await runContractWorker();
        break;
      case "mock_partner":
      case "mock_company":
      case "mock_expire":
        await advanceMock(
          id,
          b.action === "mock_partner"
            ? "partner"
            : b.action === "mock_company"
              ? "company"
              : "expire",
        );
        result = { queued: true };
        break;
      case "send":
      case "reconcile":
      case "remind":
      case "cancel":
        if (b.action === "cancel" && (!b.confirm || !b.reason))
          throw new ContractError("cancellation_confirmation_required", 400);
        await contractAudit(
          contractDatabase(),
          auth.userId,
          `admin_${b.action}_requested`,
          b.reason || "Administrator requests contract processing",
          { contractId: id },
        );
        await enqueueJob(
          contractDatabase(),
          b.action,
          `${b.action}:${id}`,
          { contractId: id },
          true,
        );
        result = { queued: true };
        break;
    }
    return contractResponse(result);
  } catch (e) {
    return contractError(e);
  }
}
