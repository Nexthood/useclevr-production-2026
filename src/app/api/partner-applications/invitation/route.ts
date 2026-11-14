import { NextResponse } from "next/server";
import { z } from "zod";
import { validWriteOrigin } from "@/lib/partners/api";
import { checkApplicationRateLimit } from "@/lib/partners/public-applications";
import {
  partnerInvitationCookie,
  requestInvitationCode,
  verifyInvitationCode,
} from "@/lib/partners/invitation-access";
import { ContractError } from "@/lib/partners/contracts/domain";
import { requestBody } from "@/lib/partners/contracts/http";
const schema = z
  .object({
    action: z.enum(["request_code", "verify"]),
    token: z.string().regex(/^[A-Za-z0-9_-]{32,100}$/),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    code: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
  })
  .strict();
const messages: Record<string, string> = {
  invalid_invitation:
    "The invitation or email is incorrect. Use the complete link and the email address that received it.",
  used_invitation:
    "This invitation has already been used. Continue to your agreements, or request a new invitation from the partner team.",
  expired_invitation: "This invitation has expired. Contact the partner team for a new invitation.",
  verification_cooldown: "Wait one minute before requesting another code.",
  verification_expired:
    "The verification code has expired or reached its attempt limit. Request a new code.",
  verification_incorrect: "The verification code is incorrect. Check the six digits in your email.",
};
export async function POST(request: Request) {
  if (!validWriteOrigin(request))
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    const b = schema.parse(await requestBody(request));
    // Separate request and verification budgets; both persist across server instances.
    const address =
      request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown";
    if (
      b.action === "request_code" &&
      !(await checkApplicationRateLimit(`invitation:${address}:${b.token}`))
    )
      throw new ContractError("verification_cooldown", 429);
    if (b.action === "request_code")
      return NextResponse.json(await requestInvitationCode(b.token, b.email), {
        headers: { "Cache-Control": "no-store" },
      });
    if (!b.code)
      return NextResponse.json({ error: "Enter the six-digit email code." }, { status: 400 });
    const token = await verifyInvitationCode(b.token, b.email, b.code);
    const response = NextResponse.json(
      { verified: true, next: "/partners/contracts" },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(partnerInvitationCookie, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400,
    });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Check the invitation, email and verification code." },
        { status: 400 },
      );
    const code = error instanceof ContractError ? error.code : "onboarding_unavailable";
    return NextResponse.json(
      {
        code,
        error:
          messages[code] ||
          "Partner onboarding is temporarily unavailable. Please retry or contact the partner team.",
      },
      {
        status: error instanceof ContractError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
