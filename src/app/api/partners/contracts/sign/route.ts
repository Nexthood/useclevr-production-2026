import { z } from "zod";
import { partnerAgreementIdentity } from "@/lib/partners/invitation-access";
import { validWriteOrigin } from "@/lib/partners/api";
import { contractError, contractResponse, requestBody } from "@/lib/partners/contracts/http";
import { privateContractDocument } from "@/lib/partners/contracts/access";
import { sendContract, contractRow } from "@/lib/partners/contracts/lifecycle";
import { contractDatabase } from "@/lib/partners/contracts/records";
import { ContractError, requireFeature } from "@/lib/partners/contracts/domain";
export async function POST(request: Request) {
  try {
    requireFeature();
    if (!validWriteOrigin(request)) throw new ContractError("request_origin_not_verified", 403);
    const auth = await partnerAgreementIdentity(request);
    if (!auth) throw new ContractError("invitation_verification_required", 401);
    const { contractId } = z
      .object({ contractId: z.string().min(1).max(150) })
      .strict()
      .parse(await requestBody(request));
    await privateContractDocument(contractId, "source", auth.userId, false, auth.applicationId);
    const c = await contractRow(contractDatabase(), contractId);
    if (c.mode !== "dropbox_live" || !["generated", "sent"].includes(c.status))
      throw new ContractError("signing_unavailable_contact_partner_team");
    await sendContract(contractId);
    return contractResponse({
      message:
        "Open the secure Dropbox Sign invitation in your email to review and sign the agreement.",
    });
  } catch (e) {
    return contractError(e);
  }
}
