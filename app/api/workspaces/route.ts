// app/api/workspaces/route.ts
// Workspace management API - CRUD operations for workspaces

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createWorkspace, getUserWorkspaces } from '@/lib/workspace-permissions';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaces = await getUserWorkspaces(session.user.id);
    
    return NextResponse.json({ workspaces });
  } catch (error: any) {
    console.error('[WORKSPACES] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, slug } = await request.json();
    
    if (!name) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    }

    const workspace = await createWorkspace(session.user.id, name, slug);
    
    return NextResponse.json({ workspace });
  } catch (error: any) {
    console.error('[WORKSPACES] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
