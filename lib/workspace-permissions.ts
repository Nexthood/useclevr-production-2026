/**
 * Workspace Permissions
 * 
 * Provides workspace and permission management functions.
 * Handles role-based access control for workspaces.
 */

import { db } from './db';
import { workspaces, workspaceMembers, workspaceInvitations, workspaceRoles, WorkspaceRole, datasets } from './db/schema';
import { eq, and, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  avatarUrl?: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMemberInfo {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: Date;
  user?: {
    id: string;
    name?: string;
    email: string;
    image?: string;
  };
}

/**
 * Get user's role in a workspace
 */
export async function getUserWorkspaceRole(
  userId: string,
  workspaceId: string
): Promise<WorkspaceRole | null> {
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  });
  
  return member?.role || null;
}

/**
 * Check if user has permission in workspace
 */
export async function hasWorkspacePermission(
  userId: string,
  workspaceId: string,
  requiredRole: WorkspaceRole
): Promise<boolean> {
  const userRole = await getUserWorkspaceRole(userId, workspaceId);
  
  if (!userRole) return false;
  
  // Role hierarchy: owner > admin > member > viewer
  const roleHierarchy: Record<WorkspaceRole, number> = {
    owner: 4,
    admin: 3,
    member: 2,
    viewer: 1,
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Get all workspaces for a user
 */
export async function getUserWorkspaces(userId: string): Promise<WorkspaceMemberInfo[]> {
  const members = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.userId, userId),
    with: {
      workspace: true,
    },
  });
  
  return members.map(m => ({
    id: m.id,
    workspaceId: m.workspaceId,
    userId: m.userId,
    role: m.role as WorkspaceRole,
    joinedAt: m.joinedAt,
    workspace: m.workspace,
  }));
}

/**
 * Create a new workspace
 */
export async function createWorkspace(
  userId: string,
  name: string,
  slug?: string
): Promise<Workspace> {
  const workspaceId = uuidv4();
  const workspaceSlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  
  // Create workspace
  await db.insert(workspaces).values({
    id: workspaceId,
    name,
    slug: workspaceSlug,
    ownerId: userId,
  });
  
  // Add owner as member
  await db.insert(workspaceMembers).values({
    id: uuidv4(),
    workspaceId,
    userId,
    role: 'owner',
  });
  
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });
  
  return workspace!;
}

/**
 * Invite user to workspace
 */
export async function inviteToWorkspace(
  inviterId: string,
  workspaceId: string,
  email: string,
  role: WorkspaceRole = 'member'
): Promise<{ success: boolean; error?: string }> {
  // Check if inviter has permission
  const hasPermission = await hasWorkspacePermission(inviterId, workspaceId, 'admin');
  if (!hasPermission) {
    return { success: false, error: 'You do not have permission to invite users' };
  }
  
  // Check if already a member
  const existingMember = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, email) // Would need to join with users table
    ),
  });
  
  if (existingMember) {
    return { success: false, error: 'User is already a member' };
  }
  
  // Create invitation
  const invitationToken = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
  
  await db.insert(workspaceInvitations).values({
    id: uuidv4(),
    workspaceId,
    email,
    role,
    invitedBy: inviterId,
    token: invitationToken,
    expiresAt,
    status: 'pending',
  });
  
  return { success: true };
}

/**
 * Accept workspace invitation
 */
export async function acceptWorkspaceInvitation(
  userId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const invitation = await db.query.workspaceInvitations.findFirst({
    where: eq(workspaceInvitations.token, token),
  });
  
  if (!invitation) {
    return { success: false, error: 'Invalid invitation' };
  }
  
  if (invitation.status !== 'pending') {
    return { success: false, error: 'Invitation already processed' };
  }
  
  if (new Date() > invitation.expiresAt) {
    return { success: false, error: 'Invitation expired' };
  }
  
  // Add member
  await db.insert(workspaceMembers).values({
    id: uuidv4(),
    workspaceId: invitation.workspaceId,
    userId,
    role: invitation.role as WorkspaceRole,
  });
  
  // Update invitation status
  await db.update(workspaceInvitations)
    .set({ status: 'accepted' })
    .where(eq(workspaceInvitations.id, invitation.id));
  
  return { success: true };
}

/**
 * Remove member from workspace
 */
export async function removeWorkspaceMember(
  removerId: string,
  workspaceId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  // Check if remover has permission
  const hasPermission = await hasWorkspacePermission(removerId, workspaceId, 'admin');
  if (!hasPermission) {
    return { success: false, error: 'You do not have permission to remove members' };
  }
  
  // Get member to be removed
  const member = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.id, memberId),
  });
  
  if (!member) {
    return { success: false, error: 'Member not found' };
  }
  
  // Can't remove owner
  if (member.role === 'owner') {
    return { success: false, error: 'Cannot remove workspace owner' };
  }
  
  // Remove member
  await db.delete(workspaceMembers)
    .where(eq(workspaceMembers.id, memberId));
  
  return { success: true };
}

/**
 * Update member role
 */
export async function updateMemberRole(
  updaterId: string,
  workspaceId: string,
  memberId: string,
  newRole: WorkspaceRole
): Promise<{ success: boolean; error?: string }> {
  // Check if updater has permission
  const hasPermission = await hasWorkspacePermission(updaterId, workspaceId, 'admin');
  if (!hasPermission) {
    return { success: false, error: 'You do not have permission to update roles' };
  }
  
  // Get member
  const member = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.id, memberId),
  });
  
  if (!member) {
    return { success: false, error: 'Member not found' };
  }
  
  // Can't change owner role
  if (member.role === 'owner') {
    return { success: false, error: 'Cannot change owner role' };
  }
  
  // Update role
  await db.update(workspaceMembers)
    .set({ role: newRole })
    .where(eq(workspaceMembers.id, memberId));
  
  return { success: true };
}

/**
 * Get workspace members
 */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberInfo[]> {
  const members = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.workspaceId, workspaceId),
  });
  
  return members.map(m => ({
    id: m.id,
    workspaceId: m.workspaceId,
    userId: m.userId,
    role: m.role as WorkspaceRole,
    joinedAt: m.joinedAt,
  }));
}

/**
 * Check dataset access permission
 */
export async function canAccessDataset(
  userId: string,
  datasetId: string
): Promise<{ allowed: boolean; role?: WorkspaceRole; error?: string }> {
  // Get dataset
  const dataset = await db.query.datasets.findFirst({
    where: eq(datasets.id, datasetId),
  });
  
  if (!dataset) {
    return { allowed: false, error: 'Dataset not found' };
  }
  
  // If no workspace, check user ownership
  const ds = dataset as unknown as { userId: string; workspaceId?: string | null };
  if (!ds.workspaceId) {
    if (ds.userId === userId) {
      return { allowed: true, role: 'owner' };
    }
    return { allowed: false, error: 'Access denied' };
  }
  
  // Check workspace membership
  const role = await getUserWorkspaceRole(userId, ds.workspaceId);
  if (!role) {
    return { allowed: false, error: 'Not a workspace member' };
  }
  
  return { allowed: true, role };
}
