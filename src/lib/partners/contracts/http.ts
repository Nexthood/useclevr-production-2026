import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ContractError } from "./domain";
import { boundedBytes } from "./provider";
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export function contractResponse(value: unknown) {
  return NextResponse.json(value, { headers: privateHeaders });
}
export function contractError(error: unknown) {
  if (error instanceof ContractError)
    return NextResponse.json(
      { error: error.code.replaceAll("_", " "), code: error.code },
      { status: error.status, headers: privateHeaders },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: "Check the required fields.", fields: error.issues.map((i) => i.path.join(".")) },
      { status: 400, headers: privateHeaders },
    );
  return NextResponse.json(
    { error: "Contract management is temporarily unavailable." },
    { status: 503, headers: privateHeaders },
  );
}
export async function requestBody(request: Request, limit = 65536) {
  const bytes = await boundedBytes(new Response(request.body, { headers: request.headers }), limit);
  try {
    return JSON.parse(bytes.toString());
  } catch {
    throw new ContractError("invalid_json_request", 400);
  }
}
