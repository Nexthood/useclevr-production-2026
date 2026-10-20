import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import {
  listAgentPassportTraces,
  updateAgentPassport,
} from "@/lib/ai-governance/agent-passport-service";
import {
  passportApiError,
  rejectCrossOriginPassportWrite,
} from "@/lib/ai-governance/agent-passport-api";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.success) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json(
      await listAgentPassportTraces(
        { id: auth.userId, role: auth.session.user.role },
        id,
        Number(new URL(request.url).searchParams.get("offset") || 0),
      ),
    );
  } catch (error) {
    return passportApiError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.success) return auth.error;
  const forbidden = rejectCrossOriginPassportWrite(request);
  if (forbidden) return forbidden;
  try {
    const { id } = await context.params;
    const passport = await updateAgentPassport(auth.userId, id, await request.json());
    return NextResponse.json({ passport });
  } catch (error) {
    return passportApiError(error);
  }
}
