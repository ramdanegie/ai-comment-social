CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topup_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"ai_units" integer NOT NULL,
	"price_idr" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "topup_package_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "redirect_url" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_superadmin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_topup_package_id_topup_packages_id_fk" FOREIGN KEY ("topup_package_id") REFERENCES "public"."topup_packages"("id") ON DELETE no action ON UPDATE no action;