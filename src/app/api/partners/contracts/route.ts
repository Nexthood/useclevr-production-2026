import { z } from "zod";
import { partnerAgreementIdentity } from "@/lib/partners/invitation-access";
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
export async function GET(request: Request) {
  const auth = await partnerAgreementIdentity(request);
  if (!auth) return contractResponse({ error: "Verify your invitation or sign in." }, 401);
  try {
    requireFeature();
    return contractResponse(await contractView(auth.userId, false, auth.applicationId));
  } catch (e) {
    return contractError(e);
  }
}
export async function POST(request: Request) {
  const auth = await partnerAgreementIdentity(request);
  if (!auth) return contractResponse({ error: "Verify your invitation or sign in." }, 401);
  try {
    requireFeature();
    if (!validWriteOrigin(request)) throw new ContractError("request_origin_not_verified", 403);
    const b = z
      .object({ applicationId: text(1, 150), identity: identitySchema })
      .strict()
      .parse(await requestBody(request));
    if (auth.applicationId && b.applicationId !== auth.applicationId)
      throw new ContractError("application_not_found", 404);
    return contractResponse(await submitContractIdentity(auth.userId, b.applicationId, b.identity));
  } catch (e) {
    return contractError(e);
  }
}
