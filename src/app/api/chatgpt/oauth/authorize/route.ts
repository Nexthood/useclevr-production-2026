import {
  ChatGptOAuthError,
  buildLoginRedirect,
  createChatGptAuthorizationCode,
  createConsentToken,
  getChatGptConsentUser,
  getChatGptOAuthIssuer,
  validateAuthorizationRequest,
  verifyConsentToken,
} from "@/lib/chatgpt/oauth";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authorization = validateAuthorizationRequest(request);
    const user = await getChatGptConsentUser();
    if (!user) {
      return NextResponse.redirect(buildLoginRedirect(request));
    }

    return htmlResponse(renderConsentPage({
      userLabel: user.email || user.name || "your UseClevr account",
      scopes: authorization.scopes,
      consentToken: createConsentToken(user.id, authorization),
    }));
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getChatGptConsentUser();
    if (!user) {
      return NextResponse.redirect(buildLoginRedirect(request));
    }

    const formData = await request.formData();
    const consentToken = formData.get("consentToken");
    const approved = formData.get("approved") === "yes";
    if (typeof consentToken !== "string") {
      throw new ChatGptOAuthError("invalid_request", "Consent token is required.");
    }

    const authorization = verifyConsentToken(consentToken, user.id);
    const redirectUrl = new URL(authorization.redirectUri);
    if (!approved) {
      redirectUrl.searchParams.set("error", "access_denied");
      if (authorization.state) redirectUrl.searchParams.set("state", authorization.state);
      redirectUrl.searchParams.set("iss", getChatGptOAuthIssuer(request));
      return NextResponse.redirect(redirectUrl);
    }

    const code = await createChatGptAuthorizationCode(user.id, authorization);
    redirectUrl.searchParams.set("code", code);
    if (authorization.state) redirectUrl.searchParams.set("state", authorization.state);
    redirectUrl.searchParams.set("iss", getChatGptOAuthIssuer(request));
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

function renderConsentPage(input: {
  userLabel: string;
  scopes: string[];
  consentToken: string;
}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connect UseClevr to ChatGPT</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
    main { width: min(92vw, 440px); border: 1px solid color-mix(in srgb, CanvasText 16%, transparent); border-radius: 8px; padding: 28px; }
    h1 { font-size: 1.45rem; line-height: 1.2; margin: 0 0 12px; }
    p, li { line-height: 1.55; }
    ul { padding-left: 1.2rem; }
    form { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
    button { border: 0; border-radius: 6px; padding: 10px 14px; font-weight: 650; cursor: pointer; }
    button[name="approved"] { background: #0f766e; color: white; }
    button[type="submit"]:not([name="approved"]) { background: color-mix(in srgb, CanvasText 12%, transparent); color: CanvasText; }
  </style>
</head>
<body>
  <main>
    <h1>Connect UseClevr to ChatGPT</h1>
    <p>ChatGPT is requesting access to analyze datasets in ${escapeHtml(input.userLabel)}.</p>
    <ul>${input.scopes.map((scope) => `<li>${scopeLabel(scope)}</li>`).join("")}</ul>
    <form method="post">
      <input type="hidden" name="consentToken" value="${escapeHtml(input.consentToken)}">
      <button type="submit" name="approved" value="yes">Allow</button>
      <button type="submit" name="approved" value="no">Cancel</button>
    </form>
  </main>
</body>
</html>`;
}

function scopeLabel(scope: string) {
  if (scope === "dataset:write") return "Upload datasets to your UseClevr account";
  return "Read and analyze your UseClevr datasets";
}

function htmlResponse(body: string) {
  return new NextResponse(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function oauthErrorResponse(error: unknown) {
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
