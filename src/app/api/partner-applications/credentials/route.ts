import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { partnerInvitationCookie } from "@/lib/partners/invitation-access";
import { validWriteOrigin } from "@/lib/partners/api";
import { requestBody } from "@/lib/partners/contracts/http";
import { ContractError } from "@/lib/partners/contracts/domain";
import { establishPartnerCredentials } from "@/lib/partners/credentials";
export async function POST(request: Request) {
  if (!validWriteOrigin(request))
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    const { password } = z
      .object({ password: z.string().min(1).max(200) })
      .strict()
      .parse(await requestBody(request));
    const token = (await cookies()).get(partnerInvitationCookie)?.value || "";
    const result = await establishPartnerCredentials(token, password);
    return NextResponse.json(result, {
      status: "status" in result ? result.status : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const code = error instanceof ContractError ? error.code : "account_setup_unavailable";
    const message =
      code === "complete_verified_agreement_before_account_setup"
        ? "Complete your agreement signatures before setting up login credentials."
        : code === "partner_account_setup_complete"
          ? "Account setup is complete. Sign in with your existing credentials."
          : "Verify your partner invitation and retry account setup. Contact the partner team if the problem continues.";
    return NextResponse.json(
      { code, error: error instanceof z.ZodError ? "Enter a valid password." : message },
      {
        status:
          error instanceof z.ZodError ? 400 : error instanceof ContractError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
