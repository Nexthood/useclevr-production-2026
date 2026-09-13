CREATE TABLE "EmailVerificationCode" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"email" varchar(255) NOT NULL,
	"codeHash" text NOT NULL,
	"purpose" varchar(20) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EmailVerificationCode" ADD CONSTRAINT "EmailVerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "EmailVerificationCode_email_purpose_idx" ON "EmailVerificationCode" USING btree ("email","purpose");
--> statement-breakpoint
CREATE INDEX "EmailVerificationCode_userId_purpose_idx" ON "EmailVerificationCode" USING btree ("userId","purpose");
