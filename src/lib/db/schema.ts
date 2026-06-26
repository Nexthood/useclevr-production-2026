import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// User table - NextAuth compatible
export const users = pgTable(
  "User",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: varchar("email", { length: 255 }).unique(),
    emailVerified: timestamp("emailVerified"),
    image: text("image"),
    password: text("password"),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("User_email_key").on(table.email),
  }),
);

// Account table - NextAuth compatible
export const accounts = pgTable(
  "Account",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: varchar("token_type", { length: 255 }),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "Account_userId_fkey",
    }).onDelete("cascade"),
    userProviderIdx: uniqueIndex("Account_provider_providerAccountId_key").on(
      table.provider,
      table.providerAccountId,
    ),
  }),
);

// Session table - NextAuth compatible
export const sessions = pgTable(
  "Session",
  {
    id: text("id").primaryKey(),
    sessionToken: varchar("sessionToken", { length: 255 }).unique().notNull(),
    userId: text("userId").notNull(),
    expires: timestamp("expires").notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "Session_userId_fkey",
    }).onDelete("cascade"),
    sessionTokenIdx: uniqueIndex("Session_sessionToken_key").on(table.sessionToken),
  }),
);

// VerificationToken table - NextAuth compatible
export const verificationTokens = pgTable(
  "VerificationToken",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expires: timestamp("expires").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.identifier, table.token],
      name: "VerificationToken_identifier_token_pk",
    }),
  }),
);

export const emailVerificationCodes = pgTable(
  "EmailVerificationCode",
  {
    id: text("id").primaryKey(),
    userId: text("userId"),
    email: varchar("email", { length: 255 }).notNull(),
    codeHash: text("codeHash").notNull(),
    purpose: varchar("purpose", { length: 20 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    attempts: integer("attempts").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "EmailVerificationCode_userId_fkey",
    }).onDelete("cascade"),
    emailPurposeIdx: index("EmailVerificationCode_email_purpose_idx").on(
      table.email,
      table.purpose,
    ),
    userPurposeIdx: index("EmailVerificationCode_userId_purpose_idx").on(
      table.userId,
      table.purpose,
    ),
  }),
);

// Profile table - custom table
export const profiles = pgTable(
  "Profile",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull().unique(),
    email: varchar("email", { length: 255 }),
    fullName: varchar("fullName", { length: 255 }),
    avatarUrl: text("avatarUrl"),
    credits: integer("credits").default(0).notNull(),
    freeUploadsUsed: integer("freeUploadsUsed").default(0).notNull(),
    analysisCount: integer("analysisCount").default(0).notNull(),
    subscriptionTier: varchar("subscriptionTier", { length: 255 }).default("free").notNull(),
    preferredCurrency: varchar("preferredCurrency", { length: 3 }).default("EUR").notNull(),
    numberFormat: varchar("numberFormat", { length: 10 }).default("auto").notNull(),
    themePreference: varchar("themePreference", { length: 20 }).default("system").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    // Stripe billing fields
    stripeCustomerId: text("stripeCustomerId"),
    stripeSubscriptionId: text("stripeSubscriptionId"),
    stripePriceId: text("stripePriceId"),
    stripeStatus: text("stripeStatus"),
    stripeCurrentPeriodEnd: timestamp("stripeCurrentPeriodEnd"),
    // Business details
    businessName: text("businessName"),
    businessEmail: text("businessEmail"),
    industry: text("industry"),
    location: text("location"),
    website: text("website"),
    businessDescription: text("businessDescription"),
    mentorshipUsed: integer("mentorshipUsed").default(0).notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "Profile_userId_fkey",
    }).onDelete("cascade"),
    userIdIdx: uniqueIndex("Profile_userId_key").on(table.userId),
  }),
);

export const businesses = pgTable(
  "Business",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    name: text("name").notNull(),
    companyNumber: text("companyNumber"),
    address: text("address"),
    email: text("email"),
    industry: text("industry"),
    website: text("website"),
    description: text("description"),
    status: varchar("status", { length: 30 }).default("draft").notNull(),
    isPrimary: boolean("isPrimary").default(false).notNull(),
    localeSettings: jsonb("localeSettings")
      .$type<{
        timezone?: string;
        currency?: string;
        locale?: string;
        invoicePrefix?: string;
      }>()
      .default({})
      .notNull(),
    invoiceSettings: jsonb("invoiceSettings")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    companySetup: jsonb("companySetup").$type<Record<string, unknown>>().default({}).notNull(),
    archivedAt: timestamp("archivedAt"),
    archiveExpiresAt: timestamp("archiveExpiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "Business_userId_fkey",
    }).onDelete("cascade"),
  }),
);

export const businessEntities = pgTable(
  "BusinessEntity",
  {
    id: text("id").primaryKey(),
    businessId: text("businessId").notNull(),
    name: text("name").notNull(),
    country: text("country"),
    address: text("address"),
    vatRegistered: boolean("vatRegistered").default(false).notNull(),
    vatNumber: text("vatNumber"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    businessIdFk: foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "BusinessEntity_businessId_fkey",
    }).onDelete("cascade"),
  }),
);

export const countryTaxProfiles = pgTable("CountryTaxProfile", {
  countryCode: varchar("countryCode", { length: 32 }).primaryKey(),
  countryName: text("countryName").notNull(),
  vatRates: jsonb("vatRates").$type<Record<string, unknown>>().default({}).notNull(),
  corporateTaxRates: jsonb("corporateTaxRates")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  filingDeadlines: jsonb("filingDeadlines").$type<Record<string, unknown>>().default({}).notNull(),
  requirements: jsonb("requirements").$type<Record<string, unknown>>().default({}).notNull(),
  lastUpdated: timestamp("lastUpdated"),
  cachedAt: timestamp("cachedAt").defaultNow().notNull(),
});

// Dataset table - custom table
export const datasets = pgTable(
  "Dataset",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    fileSize: integer("fileSize"),
    mimeType: varchar("mimeType", { length: 100 }),
    storageKey: varchar("storageKey", { length: 500 }),
    checksum: varchar("checksum", { length: 64 }),
    rowCount: integer("rowCount").default(0).notNull(),
    columnCount: integer("columnCount").default(0).notNull(),
    columns: jsonb("columns").$type<string[]>().default([]).notNull(),
    data: jsonb("data").$type<Record<string, any>[]>().default([]).notNull(),
    columnTypes: jsonb("columnTypes").$type<Record<string, string>>(),

    // Pipeline-specific fields
    previewRowCount: integer("previewRowCount").default(1000),
    previewGenerated: boolean("previewGenerated").default(false),
    fullAnalysisCompleted: boolean("fullAnalysisCompleted").default(false),

    // Status tracking
    analysisStatus: varchar("analysisStatus", { length: 50 }).default("uploading"),
    analysisProgress: integer("analysisProgress").default(0),
    analysisMessage: text("analysisMessage"),
    analysisError: text("analysisError"),

    // Data quality
    invalidRowCount: integer("invalidRowCount").default(0),
    missingValueCounts: jsonb("missingValueCounts").$type<Record<string, number>>(),

    // Precomputed metrics (single source of truth)
    precomputedMetrics: jsonb("precomputedMetrics"),
    columnMapping: jsonb("columnMapping"),
    detectedColumns: jsonb("detectedColumns"),

    // AI Insights
    aiInsights: jsonb("aiInsights"),

    // Legacy field - deprecated
    status: varchar("status", { length: 255 }).default("processing").notNull(),
    analysis: jsonb("analysis").default({}).notNull(),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "Dataset_userId_fkey",
    }).onDelete("cascade"),
  }),
);

// DatasetRow table - custom table
export const datasetRows = pgTable(
  "DatasetRow",
  {
    id: text("id").primaryKey(),
    datasetId: text("datasetId").notNull(),
    rowIndex: integer("rowIndex").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    datasetIdFk: foreignKey({
      columns: [table.datasetId],
      foreignColumns: [datasets.id],
      name: "DatasetRow_datasetId_fkey",
    }).onDelete("cascade"),
    datasetIdIdx: index("DatasetRow_datasetId_idx").on(table.datasetId),
    rowIndexIdx: index("DatasetRow_datasetId_rowIndex_idx").on(table.datasetId, table.rowIndex),
  }),
);

// UserActivity table - lightweight product activity feed
export const userActivities = pgTable(
  "UserActivity",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    userEmail: varchar("userEmail", { length: 255 }),
    type: varchar("type", { length: 80 }).notNull(),
    feature: varchar("feature", { length: 80 }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "UserActivity_userId_fkey",
    }).onDelete("cascade"),
  }),
);

// ============================================================================
// WAITLIST TABLE - Lightweight email collection
// ============================================================================
export const waitlist = pgTable(
  "Waitlist",
  {
    id: text("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    source: varchar("source", { length: 50 }).default("landing_page"),
    status: varchar("status", { length: 50 }).default("new"), // 'new', 'contacted', 'converted'
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("Waitlist_email_key").on(table.email),
  }),
);

// ============================================================================
// WORKSPACE TABLES - Team collaboration
// ============================================================================

// Workspace roles
export const workspaceRoles = ["owner", "admin", "member", "viewer"] as const;
export type WorkspaceRole = (typeof workspaceRoles)[number];

// Workspace table
export const workspaces = pgTable(
  "Workspace",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).unique().notNull(),
    description: text("description"),
    avatarUrl: text("avatarUrl"),
    ownerId: text("ownerId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    ownerIdFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "Workspace_ownerId_fkey",
    }).onDelete("cascade"),
    slugIdx: uniqueIndex("Workspace_slug_key").on(table.slug),
  }),
);

// Workspace members
export const workspaceMembers = pgTable(
  "WorkspaceMember",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspaceId").notNull(),
    userId: text("userId").notNull(),
    role: varchar("role", { length: 50 }).notNull().$type<WorkspaceRole>(),
    invitedBy: text("invitedBy"),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdFk: foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
      name: "WorkspaceMember_workspaceId_fkey",
    }).onDelete("cascade"),
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "WorkspaceMember_userId_fkey",
    }).onDelete("cascade"),
    workspaceUserIdx: uniqueIndex("WorkspaceMember_workspaceId_userId_key").on(
      table.workspaceId,
      table.userId,
    ),
  }),
);

// Workspace invitations
export const workspaceInvitations = pgTable(
  "WorkspaceInvitation",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspaceId").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }).notNull().$type<WorkspaceRole>(),
    invitedBy: text("invitedBy").notNull(),
    token: varchar("token", { length: 255 }).unique().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdFk: foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
      name: "WorkspaceInvitation_workspaceId_fkey",
    }).onDelete("cascade"),
    emailWorkspaceIdx: uniqueIndex("WorkspaceInvitation_email_workspaceId_key").on(
      table.email,
      table.workspaceId,
    ),
    tokenIdx: uniqueIndex("WorkspaceInvitation_token_key").on(table.token),
  }),
);

// ============================================================================
// OPERATIONAL TABLES - Support, referrals, and persisted app settings
// ============================================================================

export const supportTickets = pgTable("SupportTicket", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  userEmail: varchar("userEmail", { length: 255 }).notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  category: varchar("category", { length: 80 }).default("General").notNull(),
  priority: varchar("priority", { length: 20 }).default("normal").notNull(),
  status: varchar("status", { length: 30 }).default("open").notNull(),
  adminNote: text("adminNote").default("").notNull(),
  adminName: varchar("adminName", { length: 255 }).default("").notNull(),
  adminNoteUpdatedAt: timestamp("adminNoteUpdatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export const referralStats = pgTable(
  "ReferralStats",
  {
    code: varchar("code", { length: 32 }).primaryKey(),
    ownerUserId: text("ownerUserId"),
    ownerEmail: varchar("ownerEmail", { length: 255 }),
    clicks: integer("clicks").default(0).notNull(),
    signups: integer("signups").default(0).notNull(),
    paidReferrals: integer("paidReferrals").default(0).notNull(),
    creditsEarned: integer("creditsEarned").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: uniqueIndex("ReferralStats_code_key").on(table.code),
  }),
);

export const referralEvents = pgTable(
  "ReferralEvent",
  {
    id: text("id").primaryKey(),
    code: varchar("code", { length: 32 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    eventKey: varchar("eventKey", { length: 255 }).notNull(),
    referredUserId: text("referredUserId"),
    referredEmail: varchar("referredEmail", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    eventKeyIdx: uniqueIndex("ReferralEvent_eventKey_key").on(table.eventKey),
  }),
);

// AI interaction trace table - logs every user-AI interaction
export const aiInteractionTraces = pgTable(
  "AiInteractionTrace",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    datasetId: text("datasetId"),
    prompt: text("prompt").notNull(),
    response: text("response").notNull(),
    providerName: varchar("providerName", { length: 100 }).notNull(),
    modelName: varchar("modelName", { length: 100 }).notNull(),
    promptVersion: varchar("promptVersion", { length: 50 }),
    latencyMs: integer("latencyMs"),
    tokenCount: integer("tokenCount"),
    estimatedCostUsd: integer("estimatedCostUsd"),
    error: text("error"),
    feedback: varchar("feedback", { length: 20 }),
    feedbackText: text("feedbackText"),
    userAnonymized: boolean("userAnonymized").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "AiInteractionTrace_userId_fkey",
    }).onDelete("cascade"),
    userIdIdx: index("AiInteractionTrace_userId_idx").on(table.userId),
    createdAtIdx: index("AiInteractionTrace_createdAt_idx").on(table.createdAt),
    providerNameIdx: index("AiInteractionTrace_providerName_idx").on(table.providerName),
    feedbackIdx: index("AiInteractionTrace_feedback_idx").on(table.feedback),
  }),
);

export const appSettings = pgTable(
  "AppSetting",
  {
    key: varchar("key", { length: 120 }).primaryKey(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    keyIdx: uniqueIndex("AppSetting_key_key").on(table.key),
  }),
);

// ============================================================================
// MENTORING TABLES
// ============================================================================

export const mentoringSessionTypes = [
  "fundraising",
  "growth",
  "operations",
  "financial",
  "product",
] as const;
export type MentoringSessionType = (typeof mentoringSessionTypes)[number];

export const mentoringSessionStatuses = ["scheduled", "completed", "cancelled"] as const;
export type MentoringSessionStatus = (typeof mentoringSessionStatuses)[number];

export const mentoringSessions = pgTable(
  "MentoringSession",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    mentorId: text("mentorId"),
    type: varchar("type", { length: 50 }).notNull().$type<MentoringSessionType>(),
    status: varchar("status", { length: 30 })
      .default("scheduled")
      .notNull()
      .$type<MentoringSessionStatus>(),
    scheduledAt: timestamp("scheduledAt"),
    duration: integer("duration"),
    notes: text("notes"),
    recordingUrl: text("recordingUrl"),
    mentorName: varchar("mentorName", { length: 255 }),
    mentorExpertise: text("mentorExpertise"),
    price: integer("price"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "MentoringSession_userId_fkey",
    }).onDelete("cascade"),
    userIdIdx: index("MentoringSession_userId_idx").on(table.userId),
    statusIdx: index("MentoringSession_status_idx").on(table.status),
    scheduledAtIdx: index("MentoringSession_scheduledAt_idx").on(table.scheduledAt),
  }),
);

// ============================================================================
// MCP TABLES
// ============================================================================

export const mcpTokenScopes = ["dataset:read", "dataset:write", "admin"] as const;
export type McpTokenScope = (typeof mcpTokenScopes)[number];
export const mcpTokenStatuses = ["active", "revoked", "expired"] as const;
export type McpTokenStatus = (typeof mcpTokenStatuses)[number];

export const mcpTokens = pgTable(
  "MCPToken",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    tokenHash: varchar("tokenHash", { length: 255 }).notNull(),
    tokenPrefix: varchar("tokenPrefix", { length: 10 }).notNull(),
    scopes: text("scopes").array().notNull().$type<McpTokenScope[]>(),
    status: varchar("status", { length: 30 }).default("active").notNull().$type<McpTokenStatus>(),
    lastUsedAt: timestamp("lastUsedAt"),
    expiresAt: timestamp("expiresAt"),
    createdByUserId: text("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("MCPToken_tokenHash_key").on(table.tokenHash),
    statusIdx: index("MCPToken_status_idx").on(table.status),
  }),
);

export const mcpAuditActions = [
  "invoke_tool",
  "list_tools",
  "read_resource",
  "token_created",
  "token_revoked",
  "auth_failure",
] as const;
export type McpAuditAction = (typeof mcpAuditActions)[number];

export const mcpAuditLogs = pgTable(
  "MCPAuditLog",
  {
    id: text("id").primaryKey(),
    action: varchar("action", { length: 50 }).notNull().$type<McpAuditAction>(),
    tokenId: text("tokenId"),
    tokenName: varchar("tokenName", { length: 255 }),
    userId: text("userId"),
    toolName: varchar("toolName", { length: 100 }),
    datasetId: text("datasetId"),
    ipAddress: varchar("ipAddress", { length: 45 }),
    userAgent: text("userAgent"),
    success: boolean("success").notNull().default(true),
    errorMessage: text("errorMessage"),
    durationMs: integer("durationMs"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    actionIdx: index("MCPAuditLog_action_idx").on(table.action),
    tokenIdIdx: index("MCPAuditLog_tokenId_idx").on(table.tokenId),
    createdAtIdx: index("MCPAuditLog_createdAt_idx").on(table.createdAt),
  }),
);
