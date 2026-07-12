import {
  boolean,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const vectorJson = customType<{ data: number[] | null; driverData: number[] | null }>({
  dataType() {
    return "jsonb";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return Array.isArray(value) ? value : null;
  },
});

export const accuracyDatasetTypes = [
  "standard",
  "retail",
  "profitability",
  "accountancy",
  "prebookkeeping",
] as const;
export type AccuracyDatasetType = (typeof accuracyDatasetTypes)[number];

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
    firstName: varchar("firstName", { length: 120 }),
    companyName: text("companyName"),
    role: varchar("role", { length: 80 }),
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
    data: jsonb("data").$type<Record<string, unknown>[]>().default([]).notNull(),
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

    // Module routing
    datasetType: varchar("datasetType", { length: 50 }).default("standard"),

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

export const retrievalDocumentSourceTypes = [
  "dataset_summary",
  "column_description",
  "product_identity",
  "supplier_identity",
  "invoice_text",
  "receipt_text",
  "report_explanation",
  "controlled_summary",
  "document_chunk",
] as const;
export type RetrievalDocumentSourceType = (typeof retrievalDocumentSourceTypes)[number];

export const retrievalDocuments = pgTable(
  "RetrievalDocument",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("userId").notNull(),
    datasetId: text("datasetId").notNull(),
    datasetType: varchar("datasetType", { length: 50 }).notNull().$type<AccuracyDatasetType>(),
    sourceType: varchar("sourceType", { length: 80 }).notNull().$type<RetrievalDocumentSourceType>(),
    sourceRecordId: text("sourceRecordId").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    embedding: vectorJson("embedding"),
    embeddingModel: varchar("embeddingModel", { length: 160 }),
    embeddingDimensions: integer("embeddingDimensions"),
    contentHash: varchar("contentHash", { length: 64 }).notNull(),
    language: varchar("language", { length: 16 }).default("und").notNull(),
    ingestionStatus: varchar("ingestionStatus", { length: 30 }).default("ready").notNull(),
    ingestionError: text("ingestionError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "RetrievalDocument_userId_fkey",
    }).onDelete("cascade"),
    datasetIdFk: foreignKey({
      columns: [table.datasetId],
      foreignColumns: [datasets.id],
      name: "RetrievalDocument_datasetId_fkey",
    }).onDelete("cascade"),
    userDatasetIdx: index("RetrievalDocument_userId_datasetId_idx").on(table.userId, table.datasetId),
    datasetTypeIdx: index("RetrievalDocument_datasetType_idx").on(table.datasetType),
    contentHashIdx: index("RetrievalDocument_contentHash_idx").on(table.contentHash),
    sourceUniqueIdx: uniqueIndex("RetrievalDocument_source_unique_idx").on(
      table.userId,
      table.datasetId,
      table.sourceType,
      table.sourceRecordId,
    ),
  }),
);

export const accuracyIngestionStatuses = ["pending", "running", "completed", "failed"] as const;
export type AccuracyIngestionStatus = (typeof accuracyIngestionStatuses)[number];

export const accuracyIngestionJobs = pgTable(
  "AccuracyIngestionJob",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    datasetId: text("datasetId").notNull(),
    datasetType: varchar("datasetType", { length: 50 }).notNull().$type<AccuracyDatasetType>(),
    status: varchar("status", { length: 30 }).default("pending").notNull().$type<AccuracyIngestionStatus>(),
    documentCount: integer("documentCount").default(0).notNull(),
    embeddedCount: integer("embeddedCount").default(0).notNull(),
    skippedCount: integer("skippedCount").default(0).notNull(),
    errorMessage: text("errorMessage"),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "AccuracyIngestionJob_userId_fkey",
    }).onDelete("cascade"),
    datasetIdFk: foreignKey({
      columns: [table.datasetId],
      foreignColumns: [datasets.id],
      name: "AccuracyIngestionJob_datasetId_fkey",
    }).onDelete("cascade"),
    datasetIdIdx: index("AccuracyIngestionJob_datasetId_idx").on(table.datasetId),
    userIdStatusIdx: index("AccuracyIngestionJob_userId_status_idx").on(table.userId, table.status),
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

export const aiRequestAuditPurposes = [
  "chat",
  "dataset_analysis",
  "report_generation",
  "recommendation",
] as const;
export type AiRequestAuditPurpose = (typeof aiRequestAuditPurposes)[number];

export const aiRequestExecutionLocations = ["local", "cloud", "none"] as const;
export type AiRequestExecutionLocation = (typeof aiRequestExecutionLocations)[number];

export const aiRequestAuditLogs = pgTable(
  "AiRequestAuditLog",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    datasetId: text("datasetId"),
    providerName: varchar("providerName", { length: 160 }).notNull(),
    providerType: varchar("providerType", { length: 80 }).notNull(),
    modelName: varchar("modelName", { length: 160 }).notNull(),
    mode: varchar("mode", { length: 30 }).notNull(),
    executionLocation: varchar("executionLocation", { length: 20 })
      .notNull()
      .$type<AiRequestExecutionLocation>(),
    fallbackUsed: boolean("fallbackUsed").default(false).notNull(),
    purpose: varchar("purpose", { length: 60 }).notNull().$type<AiRequestAuditPurpose>(),
    success: boolean("success").default(true).notNull(),
    errorReason: text("errorReason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "AiRequestAuditLog_userId_fkey",
    }).onDelete("cascade"),
    datasetIdIdx: index("AiRequestAuditLog_datasetId_idx").on(table.datasetId),
    userIdIdx: index("AiRequestAuditLog_userId_idx").on(table.userId),
    createdAtIdx: index("AiRequestAuditLog_createdAt_idx").on(table.createdAt),
    purposeIdx: index("AiRequestAuditLog_purpose_idx").on(table.purpose),
    providerTypeIdx: index("AiRequestAuditLog_providerType_idx").on(table.providerType),
  }),
);

export const aiProviderConfigs = pgTable(
  "AiProviderConfig",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    providerType: varchar("providerType", { length: 40 }).default("openai-compatible").notNull(),
    providerName: varchar("providerName", { length: 120 }).notNull(),
    baseUrl: text("baseUrl").notNull(),
    modelName: varchar("modelName", { length: 160 }).notNull(),
    encryptedApiKey: text("encryptedApiKey"),
    selected: boolean("selected").default(true).notNull(),
    isEnabled: boolean("isEnabled").default(true).notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
    isFallback: boolean("isFallback").default(false).notNull(),
    priority: integer("priority").default(100).notNull(),
    lastTestLatencyMs: integer("lastTestLatencyMs"),
    lastTestModels: jsonb("lastTestModels").$type<string[]>().default([]).notNull(),
    lastTestStatus: varchar("lastTestStatus", { length: 30 }),
    lastTestMessage: text("lastTestMessage"),
    lastTestedAt: timestamp("lastTestedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "AiProviderConfig_userId_fkey",
    }).onDelete("cascade"),
    userIdIdx: index("AiProviderConfig_userId_idx").on(table.userId),
    defaultIdx: index("AiProviderConfig_user_default_idx").on(table.userId, table.isDefault),
    fallbackIdx: index("AiProviderConfig_user_fallback_idx").on(table.userId, table.isFallback),
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

// ============================================================================
// CREDIT & TOKEN MANAGEMENT TABLES
// ============================================================================

export const subscriptionPlans = pgTable(
  "SubscriptionPlan",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    tier: varchar("tier", { length: 50 }).notNull(),
    monthlyCredits: integer("monthlyCredits").notNull(),
    maxDatasets: integer("maxDatasets").notNull(),
    maxFileSizeMb: integer("maxFileSizeMb").notNull(),
    maxRowsPerDataset: integer("maxRowsPerDataset").notNull(),
    maxTeamMembers: integer("maxTeamMembers").notNull(),
    maxAiRequestsPerDay: integer("maxAiRequestsPerDay").notNull(),
    maxConcurrentAnalyses: integer("maxConcurrentAnalyses").notNull(),
    creditResetDay: integer("creditResetDay").notNull(),
    priceEur: integer("priceEur").notNull(),
    stripePriceId: text("stripePriceId"),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    tierIdx: uniqueIndex("SubscriptionPlan_tier_key").on(table.tier),
  }),
);

export const userCredits = pgTable(
  "UserCredit",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    planId: text("planId").notNull(),
    totalCredits: integer("totalCredits").notNull(),
    usedCredits: integer("usedCredits").default(0).notNull(),
    remainingCredits: integer("remainingCredits").notNull(),
    creditsResetAt: timestamp("creditsResetAt").notNull(),
    lastResetAt: timestamp("lastResetAt"),
    lifetimeCreditsEarned: integer("lifetimeCreditsEarned").default(0).notNull(),
    lifetimeCreditsUsed: integer("lifetimeCreditsUsed").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "UserCredit_userId_fkey",
    }).onDelete("cascade"),
    userIdIdx: uniqueIndex("UserCredit_userId_key").on(table.userId),
    planIdFk: foreignKey({
      columns: [table.planId],
      foreignColumns: [subscriptionPlans.id],
      name: "UserCredit_planId_fkey",
    }),
    creditsResetAtIdx: index("UserCredit_creditsResetAt_idx").on(table.creditsResetAt),
  }),
);

export const creditLedgerTypes = ["credit_grant", "credit_used", "credit_refund", "credit_adjustment", "monthly_reset", "subscription_upgrade", "subscription_downgrade"] as const;
export type CreditLedgerType = (typeof creditLedgerTypes)[number];

export const creditLedger = pgTable(
  "CreditLedger",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    type: varchar("type", { length: 30 }).notNull().$type<CreditLedgerType>(),
    amount: integer("amount").notNull(),
    balanceBefore: integer("balanceBefore").notNull(),
    balanceAfter: integer("balanceAfter").notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    description: text("description"),
    relatedDatasetId: text("relatedDatasetId"),
    relatedPlanId: text("relatedPlanId"),
    adminUserId: text("adminUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "CreditLedger_userId_fkey",
    }).onDelete("cascade"),
    userIdIdx: index("CreditLedger_userId_idx").on(table.userId),
    typeIdx: index("CreditLedger_type_idx").on(table.type),
    createdAtIdx: index("CreditLedger_createdAt_idx").on(table.createdAt),
  }),
);

export const aiProviderTypes = ["openai", "anthropic", "google", "ollama", "local"] as const;
export type AIProviderType = (typeof aiProviderTypes)[number];

export const providerModelPricing = pgTable(
  "ProviderModelPricing",
  {
    id: text("id").primaryKey(),
    provider: varchar("provider", { length: 50 }).notNull().$type<AIProviderType>(),
    model: varchar("model", { length: 100 }).notNull(),
    inputCostPer1M: integer("inputCostPer1M").notNull(),
    outputCostPer1M: integer("outputCostPer1M").notNull(),
    currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    effectiveFrom: timestamp("effectiveFrom").defaultNow().notNull(),
    effectiveTo: timestamp("effectiveTo"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    providerModelIdx: uniqueIndex("ProviderModelPricing_provider_model_key").on(table.provider, table.model),
    providerIdx: index("ProviderModelPricing_provider_idx").on(table.provider),
    isActiveIdx: index("ProviderModelPricing_isActive_idx").on(table.isActive),
  }),
);

export const aiActionTypes = [
  "dataset_analysis",
  "ai_chat",
  "dashboard_generation",
  "report_generation",
  "forecast_analysis",
  "multi_dataset_analysis",
  "data_insight",
  "mcp_tool_invocation",
] as const;
export type AIActionType = (typeof aiActionTypes)[number];

export const aiCostLogs = pgTable(
  "AICostLog",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    organizationId: text("organizationId"),
    subscriptionPlan: varchar("subscriptionPlan", { length: 50 }),
    provider: varchar("provider", { length: 50 }).notNull().$type<AIProviderType>(),
    model: varchar("model", { length: 100 }).notNull(),
    actionType: varchar("actionType", { length: 50 }).notNull().$type<AIActionType>(),
    inputTokens: integer("inputTokens").default(0).notNull(),
    outputTokens: integer("outputTokens").default(0).notNull(),
    totalTokens: integer("totalTokens").default(0).notNull(),
    estimatedCostEur: integer("estimatedCostEur").notNull(),
    creditsCharged: integer("creditsCharged").notNull(),
    requestStatus: varchar("requestStatus", { length: 20 }).default("success").notNull(),
    errorMessage: text("errorMessage"),
    datasetId: text("datasetId"),
    requestMetadata: jsonb("requestMetadata").$type<Record<string, unknown>>().default({}).notNull(),
    latencyMs: integer("latencyMs"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "AICostLog_userId_fkey",
    }).onDelete("cascade"),
    userIdIdx: index("AICostLog_userId_idx").on(table.userId),
    organizationIdIdx: index("AICostLog_organizationId_idx").on(table.organizationId),
    providerIdx: index("AICostLog_provider_idx").on(table.provider),
    modelIdx: index("AICostLog_model_idx").on(table.model),
    actionTypeIdx: index("AICostLog_actionType_idx").on(table.actionType),
    createdAtIdx: index("AICostLog_createdAt_idx").on(table.createdAt),
    requestStatusIdx: index("AICostLog_requestStatus_idx").on(table.requestStatus),
  }),
);

export const dailyAiRequestCounts = pgTable(
  "DailyAIRequestCount",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    requestCount: integer("requestCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdDateIdx: uniqueIndex("DailyAIRequestCount_userId_date_key").on(table.userId, table.date),
    userIdIdx: index("DailyAIRequestCount_userId_idx").on(table.userId),
    dateIdx: index("DailyAIRequestCount_date_idx").on(table.date),
  }),
);

export const executiveDailyHealthChecks = pgTable(
  "ExecutiveDailyHealthCheck",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    workspaceId: text("workspaceId"),
    workspaceKey: varchar("workspaceKey", { length: 255 }).notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    score: integer("score").default(0).notNull(),
    aiConfidence: integer("aiConfidence").default(0).notNull(),
    brief: jsonb("brief").$type<Record<string, unknown>>().default({}).notNull(),
    alerts: jsonb("alerts").$type<Record<string, unknown>[]>().default([]).notNull(),
    sourceHash: varchar("sourceHash", { length: 64 }),
    generatedBy: varchar("generatedBy", { length: 80 }).default("deterministic").notNull(),
    modelName: varchar("modelName", { length: 160 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "ExecutiveDailyHealthCheck_userId_fkey",
    }).onDelete("cascade"),
    workspaceFk: foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
      name: "ExecutiveDailyHealthCheck_workspaceId_fkey",
    }).onDelete("cascade"),
    workspaceDateIdx: uniqueIndex("ExecutiveDailyHealthCheck_workspaceKey_date_key").on(table.workspaceKey, table.date),
    userIdIdx: index("ExecutiveDailyHealthCheck_userId_idx").on(table.userId),
    dateIdx: index("ExecutiveDailyHealthCheck_date_idx").on(table.date),
  }),
);

export const concurrentAnalysisCounts = pgTable(
  "ConcurrentAnalysisCount",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    activeCount: integer("activeCount").default(0).notNull(),
    maxReachedAt: timestamp("maxReachedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("ConcurrentAnalysisCount_userId_key").on(table.userId),
  }),
);

// ============================================================================
// DEMO ACCESS TABLES
// ============================================================================

export const demoVerificationCodes = pgTable(
  "DemoVerificationCode",
  {
    id: text("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    emailHash: varchar("emailHash", { length: 64 }).notNull(),
    codeHash: varchar("codeHash", { length: 255 }).notNull(),
    ipHash: varchar("ipHash", { length: 64 }),
    userAgent: text("userAgent"),
    sessionToken: varchar("sessionToken", { length: 255 }),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    attempts: integer("attempts").default(0).notNull(),
    resendCount: integer("resendCount").default(0).notNull(),
    lastResendAt: timestamp("lastResendAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("DemoVerificationCode_email_idx").on(table.email),
    emailHashIdx: index("DemoVerificationCode_emailHash_idx").on(table.emailHash),
    sessionTokenIdx: index("DemoVerificationCode_sessionToken_idx").on(table.sessionToken),
    statusIdx: index("DemoVerificationCode_status_idx").on(table.status),
    expiresAtIdx: index("DemoVerificationCode_expiresAt_idx").on(table.expiresAt),
  }),
);

export const demoUsage = pgTable(
  "DemoUsage",
  {
    id: text("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    emailHash: varchar("emailHash", { length: 64 }).notNull(),
    ipHash: varchar("ipHash", { length: 64 }),
    sessionToken: varchar("sessionToken", { length: 255 }),
    totalCreditsUsed: integer("totalCreditsUsed").default(0).notNull(),
    datasetUploads: integer("datasetUploads").default(0).notNull(),
    aiRequests: integer("aiRequests").default(0).notNull(),
    rowCountTotal: integer("rowCountTotal").default(0).notNull(),
    hasVerifiedEmail: boolean("hasVerifiedEmail").default(false).notNull(),
    blockedAt: timestamp("blockedAt"),
    blockReason: text("blockReason"),
    firstAccessAt: timestamp("firstAccessAt").defaultNow().notNull(),
    lastAccessAt: timestamp("lastAccessAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("DemoUsage_email_key").on(table.email),
    emailHashIdx: index("DemoUsage_emailHash_idx").on(table.emailHash),
    sessionTokenIdx: index("DemoUsage_sessionToken_idx").on(table.sessionToken),
  }),
);

export const demoSessions = pgTable(
  "DemoSession",
  {
    id: text("id").primaryKey(),
    demoUsageId: text("demoUsageId").notNull(),
    sessionToken: varchar("sessionToken", { length: 255 }).notNull(),
    creditsUsed: integer("creditsUsed").default(0).notNull(),
    datasetsCreated: integer("datasetsCreated").default(0).notNull(),
    aiRequests: integer("aiRequests").default(0).notNull(),
    ipHash: varchar("ipHash", { length: 64 }),
    userAgent: text("userAgent"),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    demoUsageIdIdx: index("DemoSession_demoUsageId_idx").on(table.demoUsageId),
    sessionTokenIdx: uniqueIndex("DemoSession_sessionToken_key").on(table.sessionToken),
    expiresAtIdx: index("DemoSession_expiresAt_idx").on(table.expiresAt),
  }),
);
