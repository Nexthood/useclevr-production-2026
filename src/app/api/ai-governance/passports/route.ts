import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import {
  createAgentPassport,
  listAgentPassports,
} from "@/lib/ai-governance/agent-passport-service";
import {
  passportApiError,
  rejectCrossOriginPassportWrite,
} from "@/lib/ai-governance/agent-passport-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if (!auth.success) return auth.error;
  try {
    const passports = await listAgentPassports({ id: auth.userId, role: auth.session.user.role });
    return NextResponse.json({ passports });
  } catch (error) {
    return passportApiError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.success) return auth.error;
  const forbidden = rejectCrossOriginPassportWrite(request);
  if (forbidden) return forbidden;
  try {
    const passport = await createAgentPassport(auth.userId, await request.json());
    return NextResponse.json({ passport }, { status: 201 });
  } catch (error) {
    return passportApiError(error);
  }
}
