// app/api/workspaces/[id]/members/route.ts
// Workspace members management

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWorkspaceMembers, removeWorkspaceMember, updateMemberRole, hasWorkspacePermission } from '@/lib/workspace-permissions';
import { WorkspaceRole } from '@/lib/db/schema';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = await params;
    
    // Check access
    const hasAccess = await hasWorkspacePermission(session.user.id, workspaceId, 'viewer');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const members = await getWorkspaceMembers(workspaceId);
    
    return NextResponse.json({ members });
  } catch (error: any) {
    console.error('[WORKSPACE-MEMBERS] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = await params;
    const { memberId } = await request.json();
    
    const result = await removeWorkspaceMember(session.user.id, workspaceId, memberId);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[WORKSPACE-MEMBERS] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = await params;
    const { memberId, role } = await request.json();
    
    if (!role || !['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    
    const result = await updateMemberRole(session.user.id, workspaceId, memberId, role as WorkspaceRole);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[WORKSPACE-MEMBERS] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
