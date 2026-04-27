import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  foreignKey,
  primaryKey,
} from 'drizzle-orm/pg-core'

// User table - NextAuth compatible
export const users = pgTable(
  'User',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    email: varchar('email', { length: 255 }).unique(),
    emailVerified: timestamp('emailVerified'),
    image: text('image'),
    password: text('password'),
    createdAt: timestamp('createdAt').defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex('User_email_key').on(table.email),
  })
)

// Account table - NextAuth compatible
export const accounts = pgTable(
  'Account',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    type: varchar('type', { length: 255 }).notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerAccountId: varchar('providerAccountId', { length: 255 }).notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: varchar('token_type', { length: 255 }),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'Account_userId_fkey',
    }).onDelete('cascade'),
    userProviderIdx: uniqueIndex('Account_provider_providerAccountId_key')
      .on(table.provider, table.providerAccountId),
  })
)

// Session table - NextAuth compatible
export const sessions = pgTable(
  'Session',
  {
    id: text('id').primaryKey(),
    sessionToken: varchar('sessionToken', { length: 255 }).unique().notNull(),
    userId: text('userId').notNull(),
    expires: timestamp('expires').notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'Session_userId_fkey',
    }).onDelete('cascade'),
    sessionTokenIdx: uniqueIndex('Session_sessionToken_key').on(table.sessionToken),
  })
)

// VerificationToken table - NextAuth compatible
export const verificationTokens = pgTable(
  'VerificationToken',
  {
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expires: timestamp('expires').notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.identifier, table.token],
      name: 'VerificationToken_identifier_token_pk',
    }),
  })
)

// Profile table - custom table
export const profiles = pgTable(
  'Profile',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull().unique(),
    email: varchar('email', { length: 255 }),
    fullName: varchar('fullName', { length: 255 }),
    avatarUrl: text('avatarUrl'),
    credits: integer('credits').default(0).notNull(),
    freeUploadsUsed: integer('freeUploadsUsed').default(0).notNull(),
    analysisCount: integer('analysisCount').default(0).notNull(),
    subscriptionTier: varchar('subscriptionTier', { length: 255 }).default('free').notNull(),
    preferredCurrency: varchar('preferredCurrency', { length: 3 }).default('EUR').notNull(),
    numberFormat: varchar('numberFormat', { length: 10 }).default('auto').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'Profile_userId_fkey',
    }).onDelete('cascade'),
    userIdIdx: uniqueIndex('Profile_userId_key').on(table.userId),
  })
)

// Dataset table - custom table
export const datasets = pgTable(
  'Dataset',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    fileName: varchar('fileName', { length: 255 }).notNull(),
    fileSize: integer('fileSize'),
    mimeType: varchar('mimeType', { length: 100 }),
    storageKey: varchar('storageKey', { length: 500 }),
    checksum: varchar('checksum', { length: 64 }),
    rowCount: integer('rowCount').default(0).notNull(),
    columnCount: integer('columnCount').default(0).notNull(),
    columns: jsonb('columns').$type<string[]>().default([]).notNull(),
    data: jsonb('data').$type<Record<string, any>[]>().default([]).notNull(),
    columnTypes: jsonb('columnTypes').$type<Record<string, string>>(),
    
    // Pipeline-specific fields
    previewRowCount: integer('previewRowCount').default(1000),
    previewGenerated: boolean('previewGenerated').default(false),
    fullAnalysisCompleted: boolean('fullAnalysisCompleted').default(false),
    
    // Status tracking
    analysisStatus: varchar('analysisStatus', { length: 50 }).default('uploading'),
    analysisProgress: integer('analysisProgress').default(0),
    analysisMessage: text('analysisMessage'),
    analysisError: text('analysisError'),
    
    // Data quality
    invalidRowCount: integer('invalidRowCount').default(0),
    missingValueCounts: jsonb('missingValueCounts').$type<Record<string, number>>(),
    
    // Precomputed metrics (single source of truth)
    precomputedMetrics: jsonb('precomputedMetrics'),
    columnMapping: jsonb('columnMapping'),
    detectedColumns: jsonb('detectedColumns'),
    
    // AI Insights
    aiInsights: jsonb('aiInsights'),
    
    // Legacy field - deprecated
    status: varchar('status', { length: 255 }).default('processing').notNull(),
    analysis: jsonb('analysis').default({}).notNull(),
    
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'Dataset_userId_fkey',
    }).onDelete('cascade'),
  })
)

// DatasetRow table - custom table
export const datasetRows = pgTable(
  'DatasetRow',
  {
    id: text('id').primaryKey(),
    datasetId: text('datasetId').notNull(),
    rowIndex: integer('rowIndex').notNull(),
    data: jsonb('data').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    datasetIdFk: foreignKey({
      columns: [table.datasetId],
      foreignColumns: [datasets.id],
      name: 'DatasetRow_datasetId_fkey',
    }).onDelete('cascade'),
  })
)

// ============================================================================
// WAITLIST TABLE - Lightweight email collection
// ============================================================================
export const waitlist = pgTable(
  'Waitlist',
  {
    id: text('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    source: varchar('source', { length: 50 }).default('landing_page'),
    status: varchar('status', { length: 50 }).default('new'), // 'new', 'contacted', 'converted'
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex('Waitlist_email_key').on(table.email),
  })
)

// ============================================================================
// WORKSPACE TABLES - Team collaboration
// ============================================================================

// Workspace roles
export const workspaceRoles = ['owner', 'admin', 'member', 'viewer'] as const;
export type WorkspaceRole = typeof workspaceRoles[number];

// Workspace table
export const workspaces = pgTable(
  'Workspace',
  {
    id: text('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).unique().notNull(),
    description: text('description'),
    avatarUrl: text('avatarUrl'),
    ownerId: text('ownerId').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    ownerIdFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: 'Workspace_ownerId_fkey',
    }).onDelete('cascade'),
    slugIdx: uniqueIndex('Workspace_slug_key').on(table.slug),
  })
)

// Workspace members
export const workspaceMembers = pgTable(
  'WorkspaceMember',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspaceId').notNull(),
    userId: text('userId').notNull(),
    role: varchar('role', { length: 50 }).notNull().$type<WorkspaceRole>(),
    invitedBy: text('invitedBy'),
    joinedAt: timestamp('joinedAt').defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdFk: foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
      name: 'WorkspaceMember_workspaceId_fkey',
    }).onDelete('cascade'),
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'WorkspaceMember_userId_fkey',
    }).onDelete('cascade'),
    workspaceUserIdx: uniqueIndex('WorkspaceMember_workspaceId_userId_key')
      .on(table.workspaceId, table.userId),
  })
)

// Workspace invitations
export const workspaceInvitations = pgTable(
  'WorkspaceInvitation',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspaceId').notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull().$type<WorkspaceRole>(),
    invitedBy: text('invitedBy').notNull(),
    token: varchar('token', { length: 255 }).unique().notNull(),
    expiresAt: timestamp('expiresAt').notNull(),
    status: varchar('status', { length: 50 }).default('pending').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdFk: foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
      name: 'WorkspaceInvitation_workspaceId_fkey',
    }).onDelete('cascade'),
    emailWorkspaceIdx: uniqueIndex('WorkspaceInvitation_email_workspaceId_key')
      .on(table.email, table.workspaceId),
    tokenIdx: uniqueIndex('WorkspaceInvitation_token_key').on(table.token),
  })
)
