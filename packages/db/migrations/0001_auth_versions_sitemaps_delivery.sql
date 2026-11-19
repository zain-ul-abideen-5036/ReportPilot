CREATE TABLE "login_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sitemap_status" (
	"site_id" uuid NOT NULL,
	"path" text NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"warnings" integer DEFAULT 0 NOT NULL,
	"submitted" integer DEFAULT 0 NOT NULL,
	"last_downloaded" timestamp with time zone,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sitemap_status_site_id_path_pk" PRIMARY KEY("site_id","path")
);
--> statement-breakpoint
CREATE TABLE "report_versions" (
	"report_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"pdf_key" text NOT NULL,
	"reason" text DEFAULT 'render' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_versions_report_id_version_pk" PRIMARY KEY("report_id","version")
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "backfilled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "delivery_status" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "delivery_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sitemap_status" ADD CONSTRAINT "sitemap_status_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_delivery_idx" ON "reports" USING btree ("delivery_id");