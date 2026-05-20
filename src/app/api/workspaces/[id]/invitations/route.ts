import { debugError } from "@/lib/utils/debug";

// app/api/workspaces/[id]/invitations/route.ts
// Workspace invitations management

import { auth } from '@/lib/auth';
import { inviteToWorkspace } from '@/lib/utils/workspace-permissions';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = await params;
    const { email, role } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    
    const result = await inviteToWorkspace(session.user.id, workspaceId, email, role);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, message: 'Invitation sent' });
  } catch (error: any) {
    debugError('[WORKSPACE-INVITATIONS] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
