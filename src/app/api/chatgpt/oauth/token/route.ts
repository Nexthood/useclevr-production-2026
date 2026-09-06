import {
  ChatGptOAuthError,
  consumeChatGptAuthorizationCode,
  getChatGptMcpResource,
  getTokenExpiresInSeconds,
  issueChatGptAccessToken,
} from "@/lib/chatgpt/oauth";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const params = new URLSearchParams(await request.text());
    if (params.get("grant_type") !== "authorization_code") {
      throw new ChatGptOAuthError("unsupported_grant_type", "Only authorization_code is supported.");
    }

    const code = requireParam(params, "code");
    const clientId = requireParam(params, "client_id");
    const redirectUri = requireParam(params, "redirect_uri");
    const codeVerifier = requireParam(params, "code_verifier");
    const resource = requireParam(params, "resource");
    if (resource !== getChatGptMcpResource(request)) {
      throw new ChatGptOAuthError("invalid_target", "OAuth resource does not match this MCP server.");
    }

    const authorization = await consumeChatGptAuthorizationCode({
      code,
      clientId,
      redirectUri,
      resource,
      codeVerifier,
    });
    const accessToken = await issueChatGptAccessToken({
      request,
      userId: authorization.userId,
      scopes: authorization.scopes,
      clientId: authorization.clientId,
      resource: authorization.resource,
    });

    return NextResponse.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: getTokenExpiresInSeconds(),
      scope: authorization.scopes.join(" "),
    }, {
      headers: {
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ChatGptOAuthError) {
      return NextResponse.json(
        { error: error.code, error_description: error.message },
        {
          status: error.status,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

function requireParam(params: URLSearchParams, name: string) {
  const value = params.get(name);
  if (!value) {
    throw new ChatGptOAuthError("invalid_request", `${name} is required.`);
  }
  return value;
}
