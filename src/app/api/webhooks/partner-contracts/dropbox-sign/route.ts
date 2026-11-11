import { ContractError, requireFeature } from "@/lib/partners/contracts/domain";
import { boundedBytes } from "@/lib/partners/contracts/provider";
import { acceptDropboxWebhook } from "@/lib/partners/contracts/worker";
import { contractError } from "@/lib/partners/contracts/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireFeature();
    const bytes = await boundedBytes(
      new Response(request.body, { headers: request.headers }),
      262144,
    );
    let json: string;
    const type = request.headers.get("content-type") || "";
    if (type.startsWith("multipart/form-data")) {
      const form = await new Response(bytes, { headers: { "Content-Type": type } }).formData();
      const value = form.get("json");
      if (typeof value !== "string") throw new ContractError("callback_json_missing", 400);
      json = value;
    } else if (type.startsWith("application/json")) json = bytes.toString();
    else throw new ContractError("callback_content_type_invalid", 415);
    await acceptDropboxWebhook(json, request.headers.get("content-sha256"));
    return new Response("Hello API Event Received", {
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return contractError(e);
  }
}
