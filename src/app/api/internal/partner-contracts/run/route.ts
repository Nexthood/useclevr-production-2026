import { ContractError, requireFeature, safeEqual } from "@/lib/partners/contracts/domain";
import { runContractWorker } from "@/lib/partners/contracts/worker";
import { contractError, contractResponse } from "@/lib/partners/contracts/http";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    requireFeature();
    const secret = process.env.PARTNER_CONTRACT_WORKER_SECRET || "";
    if (
      secret.length < 32 ||
      !safeEqual(request.headers.get("authorization") || "", `Bearer ${secret}`)
    )
      throw new ContractError("unauthorized", 401);
    if (process.env.PARTNER_CONTRACT_WORKER_ENABLED !== "true")
      throw new ContractError("contract_worker_disabled", 404);
    return contractResponse(await runContractWorker());
  } catch (e) {
    return contractError(e);
  }
}
