import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MCP_SUBDOMAIN_PATTERN = /^mcp(?:-test)?\.useclevr\.com(:?\d+)?$/;

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const isMcpSubdomain = MCP_SUBDOMAIN_PATTERN.test(host);

  if (isMcpSubdomain) {
    const { pathname } = request.nextUrl;
    if (pathname !== "/api/mcp") {
      return new NextResponse("Not Found", { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
