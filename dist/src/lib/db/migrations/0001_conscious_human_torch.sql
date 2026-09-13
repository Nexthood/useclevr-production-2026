ALTER TABLE "DatasetRow" ALTER COLUMN "data" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "Dataset" ALTER COLUMN "columns" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "Dataset" ALTER COLUMN "columns" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "columnTypes" jsonb;--> statement-breakpoint
ALTER TABLE "Dataset" ADD COLUMN "analysis" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "preferredCurrency" varchar(3) DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "numberFormat" varchar(10) DEFAULT 'auto' NOT NULL;