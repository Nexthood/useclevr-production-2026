import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { validWriteOrigin } from "@/lib/partners/api";
import {
  ContractError,
  requireFeature,
  text,
  identitySchema,
} from "@/lib/partners/contracts/domain";
import { contractResponse, contractError, requestBody } from "@/lib/partners/contracts/http";
import { contractView } from "@/lib/partners/contracts/access";
import { submitContractIdentity } from "@/lib/partners/contracts/records";
export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireSession();
  if (!auth.success) return auth.error;
  try {
    requireFeature();
    return contractResponse(await contractView(auth.userId));
  } catch (e) {
    return contractError(e);
  }
}
export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.success) return auth.error;
  try {
    requireFeature();
    if (!validWriteOrigin(request)) throw new ContractError("request_origin_not_verified", 403);
    const b = z
      .object({ applicationId: text(1, 150), identity: identitySchema })
      .strict()
      .parse(await requestBody(request));
    return contractResponse(await submitContractIdentity(auth.userId, b.applicationId, b.identity));
  } catch (e) {
    return contractError(e);
  }
}
