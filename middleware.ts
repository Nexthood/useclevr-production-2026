import { NextRequest, NextResponse } from "next/server";

const TEST_SUBDOMAIN_PASSWORD = "erdely";

function isTestSubdomain(request: NextRequest): boolean {
  const host = request.headers.get("host") || "";
  return host.startsWith("test.") || host.startsWith("test-") || process.env.NODE_ENV === "development";
}

function getTestAuthEnv() {
  return process.env.TEST_SUBDOMAIN_AUTH === "true";
}

export function middleware(request: NextRequest) {
  // Only apply to test subdomain when auth is enabled
  if (!isTestSubdomain(request) || !getTestAuthEnv()) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const [, credentials] = authHeader.split(" ");
    if (credentials) {
      const [username, password] = Buffer.from(credentials, "base64").toString().split(":");
      if (password === TEST_SUBDOMAIN_PASSWORD) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse(
    JSON.stringify({ error: "Authentication required" }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Basic realm="Test Subdomain"',
        "Cache-Control": "no-store",
      },
    }
  );
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};