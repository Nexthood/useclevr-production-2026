import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getClevrSyncAccess } from "@/services/clevrsync/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getClevrSyncAccess(session.user);
  return NextResponse.json({ access });
}
