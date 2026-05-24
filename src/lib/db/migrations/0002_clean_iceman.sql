CREATE TABLE "AppSetting" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ReferralEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"type" varchar(20) NOT NULL,
	"eventKey" varchar(255) NOT NULL,
	"referredUserId" text,
	"referredEmail" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ReferralStats" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"ownerUserId" text,
	"ownerEmail" varchar(255),
	"clicks" integer DEFAULT 0 NOT NULL,
	"signups" integer DEFAULT 0 NOT NULL,
	"paidReferrals" integer DEFAULT 0 NOT NULL,
	"creditsEarned" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SupportTicket" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"userEmail" varchar(255) NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"category" varchar(80) DEFAULT 'General' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"adminNote" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "UserActivity" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"userEmail" varchar(255),
	"type" varchar(80) NOT NULL,
	"feature" varchar(80) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Waitlist" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"source" varchar(50) DEFAULT 'landing_page',
	"status" varchar(50) DEFAULT 'new',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "WorkspaceInvitation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"invitedBy" text NOT NULL,
	"token" varchar(255) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "WorkspaceInvitation_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "WorkspaceMember" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"userId" text NOT NULL,
	"role" varchar(50) NOT NULL,
	"invitedBy" text,
	"joinedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"avatarUrl" text,
	"ownerId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Workspace_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "mimeType" varchar(100);--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "storageKey" varchar(500);--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "checksum" varchar(64);--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "data" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "previewRowCount" integer DEFAULT 1000;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "previewGenerated" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "fullAnalysisCompleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "analysisStatus" varchar(50) DEFAULT 'uploading';--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "analysisProgress" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "analysisMessage" text;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "analysisError" text;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "invalidRowCount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "missingValueCounts" jsonb;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "precomputedMetrics" jsonb;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "columnMapping" jsonb;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "detectedColumns" jsonb;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "aiInsights" jsonb;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "analysisCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "stripeCustomerId" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "stripeSubscriptionId" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "stripePriceId" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "stripeStatus" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "stripeCurrentPeriodEnd" timestamp;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "businessName" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "businessEmail" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "businessDescription" text;--> statement-breakpoint
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "ReferralEvent_eventKey_key" ON "ReferralEvent" USING btree ("eventKey");--> statement-breakpoint
CREATE UNIQUE INDEX "ReferralStats_code_key" ON "ReferralStats" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "Waitlist_email_key" ON "Waitlist" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "WorkspaceInvitation_email_workspaceId_key" ON "WorkspaceInvitation" USING btree ("email","workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "WorkspaceInvitation_token_key" ON "WorkspaceInvitation" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember" USING btree ("workspaceId","userId");--> statement-breakpoint
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace" USING btree ("slug");