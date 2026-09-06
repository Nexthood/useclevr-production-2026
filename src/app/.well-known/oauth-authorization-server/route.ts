import { getAuthorizationServerMetadata } from "@/lib/chatgpt/oauth";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json(getAuthorizationServerMetadata(request), {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
