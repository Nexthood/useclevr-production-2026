import { NextRequest, NextResponse } from "next/server";

function getTestPassword() {
  return process.env.TEST_SUBDOMAIN_PASSWORD;
}

function isTestSubdomain(request: NextRequest): boolean {
  const host = request.headers.get("host") || "";
  const isTest = host.startsWith("test.") || host.startsWith("test-");
  const isLocalDev = process.env.NODE_ENV === "development" && process.env.TEST_SUBDOMAIN_AUTH === "true";
  return isTest || isLocalDev;
}

function getTestAuthEnv() {
  return process.env.TEST_SUBDOMAIN_AUTH === "true";
}

export function middleware(request: NextRequest) {
  if (!isTestSubdomain(request) || !getTestAuthEnv()) {
    return NextResponse.next();
  }

  const testPassword = getTestPassword();
  if (!testPassword) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const [, credentials] = authHeader.split(" ");
    if (credentials) {
      const [, password] = Buffer.from(credentials, "base64").toString().split(":");
      if (password === testPassword) {
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