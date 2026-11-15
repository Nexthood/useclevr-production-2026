import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { validWriteOrigin } from "@/lib/partners/api";
import { checkApplicationRateLimit } from "@/lib/partners/public-applications";
import { partnerContractDeliveries } from "@/lib/db/schema";
import { contractDatabase } from "@/lib/partners/contracts/records";
import { ContractError, requireFeature, sha256 } from "@/lib/partners/contracts/domain";
import {
  contractResponse,
  contractError,
  requestBody,
  privateHeaders,
} from "@/lib/partners/contracts/http";
import { deliverContractEmail } from "@/lib/partners/contracts/mail";
import {
  nativeSigningCookie,
  nativeSecurityMetadata,
  nativeSigningInput,
  requestNativeCode,
  verifyNativeCode,
  reviewNativeAgreement,
  signNativeAgreement,
} from "@/lib/partners/contracts/native";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const invitationInput = {
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  email: z.string().trim().toLowerCase().pipe(z.email()),
};
const command = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("request_code"), ...invitationInput }).strict(),
  z
    .object({
      operation: z.literal("verify"),
      ...invitationInput,
      code: z.string().regex(/^\d{6}$/),
    })
    .strict(),
  z.object({ operation: z.literal("sign"), signing: nativeSigningInput }).strict(),
]);
function proof(request: Request) {
  return (
    (request.headers.get("cookie") || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${nativeSigningCookie}=`))
      ?.slice(nativeSigningCookie.length + 1) || ""
  );
}
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/partners/contracts/native",
};
export async function GET(request: Request) {
  try {
    requireFeature();
    const pdf = new URL(request.url).searchParams.get("document") === "source";
    const result = await reviewNativeAgreement(proof(request), pdf);
    if ("bytes" in result)
      return new Response(new Uint8Array(result.bytes), {
        headers: {
          ...privateHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="partner-agreement.pdf"',
          "Content-Security-Policy": "frame-ancestors 'self'",
        },
      });
    return contractResponse(result);
  } catch (e) {
    return contractError(e);
  }
}
export async function POST(request: Request) {
  try {
    requireFeature();
    if (!validWriteOrigin(request)) throw new ContractError("request_origin_not_verified", 403);
    const b = command.parse(await requestBody(request, 4096));
    const address = (request.headers.get("x-real-ip") || "unknown").slice(0, 200);
    if (!(await checkApplicationRateLimit(`native-signing:${b.operation}:${address}`, 30)))
      throw new ContractError("signing_rate_limit", 429);
    if (b.operation === "request_code") {
      if (!(await checkApplicationRateLimit(`native-code:${sha256(b.token)}`)))
        throw new ContractError("signing_rate_limit", 429);
      const result = await requestNativeCode(b.token, b.email);
      await deliverContractEmail(result.deliveryId);
      return contractResponse({ sent: true });
    }
    if (b.operation === "verify") {
      const verified = await verifyNativeCode(b.token, b.email, b.code);
      const response = contractResponse({ verified: true });
      response.cookies.set(nativeSigningCookie, verified, { ...cookieOptions, maxAge: 30 * 60 });
      return response;
    }
    const result = await signNativeAgreement(
      proof(request),
      b.signing,
      nativeSecurityMetadata(request),
    );
    const pending = await contractDatabase().query.partnerContractDeliveries.findMany({
      where: and(
        eq(partnerContractDeliveries.contractId, result.contractId),
        eq(partnerContractDeliveries.status, "pending"),
      ),
      limit: 5,
    });
    await Promise.allSettled(pending.map((d) => deliverContractEmail(d.id)));
    const response = contractResponse(result);
    response.cookies.set(nativeSigningCookie, "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch (e) {
    return contractError(e);
  }
}
