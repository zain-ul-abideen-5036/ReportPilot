CREATE TYPE "public"."role" AS ENUM('owner', 'manager', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('collecting', 'draft', 'in_review', 'approved', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'succeeded', 'failed', 'waiting');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('plan', 'collect', 'calculate', 'insights', 'narrative', 'render', 'review', 'deliver');--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" "role" DEFAULT 'manager' NOT NULL,
	CONSTRAINT "memberships_user_id_org_id_pk" PRIMARY KEY("user_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand_logo_key" text,
	"brand_primary" text DEFAULT '#1f4d3f' NOT NULL,
	"brand_accent" text DEFAULT '#c8763b' NOT NULL,
	"sender_name" text NOT NULL,
	"sender_email" text NOT NULL,
	"footer" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"logo_key" text,
	"contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timezone" text DEFAULT 'Europe/London' NOT NULL,
	"report_day" integer DEFAULT 3 NOT NULL,
	"manager_id" uuid,
	"auto_send" boolean DEFAULT false NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"url" text NOT NULL,
	"gsc_property" text,
	"branded_regex" text,
	"key_pages" text[] DEFAULT '{}' NOT NULL,
	"uptime_keyword" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"cause" text NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tls_domain" (
	"site_id" uuid PRIMARY KEY NOT NULL,
	"cert_expires_at" timestamp with time zone,
	"issuer" text,
	"domain_expires_at" timestamp with time zone,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uptime_checks" (
	"site_id" uuid NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"ok" boolean NOT NULL,
	"status" integer,
	"ms" integer,
	"error" text,
	CONSTRAINT "uptime_checks_site_id_checked_at_pk" PRIMARY KEY("site_id","checked_at")
);
--> statement-breakpoint
CREATE TABLE "uptime_daily" (
	"site_id" uuid NOT NULL,
	"day" date NOT NULL,
	"uptime_pct" real NOT NULL,
	"avg_ms" integer NOT NULL,
	"p95_ms" integer NOT NULL,
	"incidents" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "uptime_daily_site_id_day_pk" PRIMARY KEY("site_id","day")
);
--> statement-breakpoint
CREATE TABLE "gsc_daily" (
	"site_id" uuid NOT NULL,
	"day" date NOT NULL,
	"clicks" integer NOT NULL,
	"impressions" integer NOT NULL,
	"ctr" real NOT NULL,
	"position" real NOT NULL,
	CONSTRAINT "gsc_daily_site_id_day_pk" PRIMARY KEY("site_id","day")
);
--> statement-breakpoint
CREATE TABLE "gsc_monthly_dim" (
	"site_id" uuid NOT NULL,
	"month" text NOT NULL,
	"dimension" text NOT NULL,
	"key" text NOT NULL,
	"clicks" integer NOT NULL,
	"impressions" integer NOT NULL,
	CONSTRAINT "gsc_monthly_dim_site_id_month_dimension_key_pk" PRIMARY KEY("site_id","month","dimension","key")
);
--> statement-breakpoint
CREATE TABLE "gsc_monthly_page" (
	"site_id" uuid NOT NULL,
	"month" text NOT NULL,
	"page" text NOT NULL,
	"clicks" integer NOT NULL,
	"impressions" integer NOT NULL,
	"ctr" real NOT NULL,
	"position" real NOT NULL,
	CONSTRAINT "gsc_monthly_page_site_id_month_page_pk" PRIMARY KEY("site_id","month","page")
);
--> statement-breakpoint
CREATE TABLE "gsc_monthly_query" (
	"site_id" uuid NOT NULL,
	"month" text NOT NULL,
	"query" text NOT NULL,
	"clicks" integer NOT NULL,
	"impressions" integer NOT NULL,
	"ctr" real NOT NULL,
	"position" real NOT NULL,
	CONSTRAINT "gsc_monthly_query_site_id_month_query_pk" PRIMARY KEY("site_id","month","query")
);
--> statement-breakpoint
CREATE TABLE "crux_weekly" (
	"site_id" uuid NOT NULL,
	"url_or_origin" text NOT NULL,
	"week" date NOT NULL,
	"form_factor" text NOT NULL,
	"lcp_p75" integer,
	"inp_p75" integer,
	"cls_p75" real,
	CONSTRAINT "crux_weekly_site_id_url_or_origin_week_form_factor_pk" PRIMARY KEY("site_id","url_or_origin","week","form_factor")
);
--> statement-breakpoint
CREATE TABLE "index_status" (
	"site_id" uuid NOT NULL,
	"url" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"verdict" text NOT NULL,
	"coverage_state" text NOT NULL,
	"last_crawl" timestamp with time zone,
	CONSTRAINT "index_status_site_id_url_checked_at_pk" PRIMARY KEY("site_id","url","checked_at")
);
--> statement-breakpoint
CREATE TABLE "psi_runs" (
	"site_id" uuid NOT NULL,
	"url" text NOT NULL,
	"strategy" text NOT NULL,
	"run_date" date NOT NULL,
	"perf_score" integer NOT NULL,
	"lcp" integer,
	"cls" real,
	"tbt" integer,
	"fcp" integer,
	"opportunities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "psi_runs_site_id_url_strategy_run_date_pk" PRIMARY KEY("site_id","url","strategy","run_date")
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"severity" text NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"dedupe_key" text NOT NULL,
	"raised_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"site_id" uuid,
	"period" text,
	"stage" "stage" NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"period" text NOT NULL,
	"status" "report_status" DEFAULT 'collecting' NOT NULL,
	"collected" jsonb,
	"data" jsonb,
	"narrative" jsonb,
	"manager_notes" text,
	"pdf_key" text,
	"share_token" text,
	"share_expires_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivery_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tls_domain" ADD CONSTRAINT "tls_domain_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uptime_checks" ADD CONSTRAINT "uptime_checks_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uptime_daily" ADD CONSTRAINT "uptime_daily_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_daily" ADD CONSTRAINT "gsc_daily_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_monthly_dim" ADD CONSTRAINT "gsc_monthly_dim_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_monthly_page" ADD CONSTRAINT "gsc_monthly_page_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_monthly_query" ADD CONSTRAINT "gsc_monthly_query_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crux_weekly" ADD CONSTRAINT "crux_weekly_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_status" ADD CONSTRAINT "index_status_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psi_runs" ADD CONSTRAINT "psi_runs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_org_idx" ON "clients" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sites_client_idx" ON "sites" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "incidents_site_started_idx" ON "incidents" USING btree ("site_id","started_at");--> statement-breakpoint
CREATE INDEX "index_status_site_idx" ON "index_status" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_site_dedupe_uq" ON "alerts" USING btree ("site_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "audit_org_at_idx" ON "audit_log" USING btree ("org_id","at");--> statement-breakpoint
CREATE INDEX "job_runs_site_period_idx" ON "job_runs" USING btree ("site_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_site_period_uq" ON "reports" USING btree ("site_id","period");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");