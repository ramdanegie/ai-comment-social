CREATE TYPE "public"."comment_status" AS ENUM('RECEIVED', 'CLASSIFIED', 'AUTO_REPLY_QUEUED', 'NEEDS_REVIEW', 'APPROVED', 'REPLIED', 'HIDDEN', 'DISMISSED', 'IGNORED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."intent" AS ENUM('praise', 'purchase_intent', 'question', 'complaint', 'other');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('instagram', 'facebook', 'tiktok');--> statement-breakpoint
CREATE TYPE "public"."reply_source" AS ENUM('auto', 'human_approved', 'human_written');--> statement-breakpoint
CREATE TYPE "public"."risk_label" AS ENUM('none', 'spam', 'toxic', 'hate', 'threat', 'sensitive');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'admin', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('positive', 'neutral', 'negative');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"sentiment" "sentiment" NOT NULL,
	"risk_label" "risk_label" NOT NULL,
	"intent" "intent" NOT NULL,
	"confidence" real NOT NULL,
	"reason" text,
	"prefilter_hits" text[],
	"model" text NOT NULL,
	"human_sentiment" "sentiment",
	"human_risk_label" "risk_label",
	"corrected_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "classifications_comment_id_unique" UNIQUE("comment_id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"post_id" uuid,
	"platform" "platform" NOT NULL,
	"external_id" text NOT NULL,
	"parent_external_id" text,
	"author_name" text,
	"author_external_id" text,
	"text" text NOT NULL,
	"commented_at" timestamp NOT NULL,
	"status" "comment_status" DEFAULT 'RECEIVED' NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_metrics" (
	"workspace_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"day" date NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"positive" integer DEFAULT 0 NOT NULL,
	"neutral" integer DEFAULT 0 NOT NULL,
	"negative" integer DEFAULT 0 NOT NULL,
	"risk" integer DEFAULT 0 NOT NULL,
	"spam" integer DEFAULT 0 NOT NULL,
	"auto_replied" integer DEFAULT 0 NOT NULL,
	"manual_replied" integer DEFAULT 0 NOT NULL,
	"median_response_sec" integer
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"run_at" timestamp DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"dedupe_key" text,
	CONSTRAINT "jobs_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"order_id" text NOT NULL,
	"kind" text NOT NULL,
	"plan_id" text,
	"ai_units" integer,
	"amount_idr" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"midtrans_transaction_id" text,
	"payment_type" text,
	"raw_notification" jsonb,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"monthly_ai_units" integer NOT NULL,
	"max_social_accounts" integer NOT NULL,
	"price_idr" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"caption" text,
	"permalink" text,
	"media_url" text,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"draft_text" text NOT NULL,
	"final_text" text,
	"source" "reply_source",
	"external_reply_id" text,
	"approved_by" text,
	"sent_at" timestamp,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "replies_comment_id_unique" UNIQUE("comment_id")
);
--> statement-breakpoint
CREATE TABLE "reply_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_account_id" uuid NOT NULL,
	"mode" text DEFAULT 'shadow' NOT NULL,
	"auto_reply_intents" "intent"[] NOT NULL,
	"min_confidence" real DEFAULT 0.75 NOT NULL,
	"daily_auto_reply_limit" integer DEFAULT 200 NOT NULL,
	"min_interval_seconds" integer DEFAULT 20 NOT NULL,
	"active_hours" jsonb,
	"brand_voice" jsonb NOT NULL,
	"custom_blocked_keywords" text[],
	"auto_hide_spam" boolean DEFAULT true NOT NULL,
	CONSTRAINT "reply_policies_social_account_id_unique" UNIQUE("social_account_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"external_id" text NOT NULL,
	"username" text NOT NULL,
	"avatar_url" text,
	"access_token_enc" text NOT NULL,
	"token_expires_at" timestamp,
	"scopes" text[],
	"status" text DEFAULT 'connected' NOT NULL,
	"last_synced_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"extra_ai_units" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"comment_id" uuid,
	"kind" text NOT NULL,
	"units" integer DEFAULT 1 NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_usd_micros" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classifications" ADD CONSTRAINT "classifications_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_policies" ADD CONSTRAINT "reply_policies_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_audit_ws" ON "audit_logs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_comment" ON "comments" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX "ix_comment_ws_status" ON "comments" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "ix_comment_ws_date" ON "comments" USING btree ("workspace_id","commented_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_daily" ON "daily_metrics" USING btree ("social_account_id","day");--> statement-breakpoint
CREATE INDEX "ix_jobs_pick" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_member" ON "memberships" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_post" ON "posts" USING btree ("social_account_id","external_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_account" ON "social_accounts" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX "ix_usage_ws_date" ON "usage_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");