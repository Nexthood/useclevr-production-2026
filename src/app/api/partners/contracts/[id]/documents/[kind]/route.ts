import { partnerAgreementIdentity } from "@/lib/partners/invitation-access";
import { privateContractDocument } from "@/lib/partners/contracts/access";
import { requireFeature } from "@/lib/partners/contracts/domain";
import { contractError, privateHeaders } from "@/lib/partners/contracts/http";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  const auth = await partnerAgreementIdentity(_request);
  if (!auth) return new Response("Unauthorized", { status: 401 });
  try {
    requireFeature();
    const { id, kind } = await params;
    const f = await privateContractDocument(id, kind, auth.userId, auth.admin, auth.applicationId);
    return new Response(new Uint8Array(f.bytes), {
      headers: {
        ...privateHeaders,
        "Content-Type": f.mediaType,
        "Content-Disposition": `attachment; filename="partner-agreement-${kind}.${kind === "audit" ? "json" : "pdf"}"`,
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch (e) {
    return contractError(e);
  }
}
