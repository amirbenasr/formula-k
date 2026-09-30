import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Reconcile the Stripe payment fields that the 20260122 baseline created but
  // that the Payload config no longer defines (the store is cash-on-delivery
  // only, and plugin-ecommerce dropped them from `transactions`). Without this
  // a freshly migrated database keeps three dead columns and an orphaned enum.
  //
  // Deliberately idempotent: a database that has already been reconciled by dev
  // push no longer has these objects, so both statements are no-ops there.
  // Note the column drops must precede the type drop, and the type drop is
  // additionally guarded in case anything still references it.
  await db.execute(sql`
   ALTER TABLE "transactions" DROP COLUMN IF EXISTS "payment_method";
   ALTER TABLE "transactions" DROP COLUMN IF EXISTS "stripe_customer_i_d";
   ALTER TABLE "transactions" DROP COLUMN IF EXISTS "stripe_payment_intent_i_d";
   DO $$ BEGIN
    IF NOT EXISTS (
     SELECT 1 FROM pg_attribute a
     JOIN pg_type t ON t.oid = a.atttypid
     WHERE t.typname = 'enum_transactions_payment_method'
       AND a.attnum > 0 AND NOT a.attisdropped
    ) THEN
     DROP TYPE IF EXISTS "public"."enum_transactions_payment_method";
    END IF;
   END $$;`)
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_reward_transactions_type" AS ENUM('earned', 'redeemed', 'expired', 'adjusted');
   EXCEPTION WHEN duplicate_object THEN null;
   END $$;
  DO $$ BEGIN
   CREATE TYPE "public"."enum_reward_transactions_action" AS ENUM('welcome', 'profile_complete', 'purchase', 'review', 'review_photo', 'referral', 'birthday', 'social_follow', 'checkin', 'challenge', 'redemption', 'expiry', 'admin_adjustment');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   CREATE TYPE "public"."enum_rewards_catalog_type" AS ENUM('discount_amount', 'discount_percent', 'free_product', 'free_shipping', 'free_sample');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   CREATE TYPE "public"."enum_ai_action_logs_status" AS ENUM('pending', 'applied', 'failed', 'cancelled');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   CREATE TYPE "public"."enum_products_videos_video_type" AS ENUM('upload', 'external');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   CREATE TYPE "public"."enum__products_v_version_videos_video_type" AS ENUM('upload', 'external');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   CREATE TYPE "public"."enum_site_settings_color_palette" AS ENUM('warm', 'cool');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  ALTER TYPE "public"."enum_transactions_status" ADD VALUE IF NOT EXISTS 'processing' BEFORE 'succeeded';
  CREATE TABLE IF NOT EXISTS "reward_tiers_benefits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"benefit" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "reward_tiers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"min_points" numeric DEFAULT 0 NOT NULL,
  	"points_multiplier" numeric DEFAULT 1 NOT NULL,
  	"icon" varchar,
  	"color" varchar,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "reward_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"type" "enum_reward_transactions_type" NOT NULL,
  	"points" numeric NOT NULL,
  	"action" "enum_reward_transactions_action" NOT NULL,
  	"description" varchar,
  	"related_order_id" integer,
  	"related_reward_id" integer,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "rewards_catalog" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"points_cost" numeric NOT NULL,
  	"type" "enum_rewards_catalog_type" NOT NULL,
  	"discount_value" numeric,
  	"free_product_id" integer,
  	"image_id" integer,
  	"minimum_tier_id" integer,
  	"limit_per_user" numeric DEFAULT 0,
  	"total_available" numeric DEFAULT 0,
  	"total_redeemed" numeric DEFAULT 0,
  	"is_active" boolean DEFAULT true,
  	"is_featured" boolean DEFAULT false,
  	"valid_from" timestamp(3) with time zone,
  	"valid_until" timestamp(3) with time zone,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "ai_action_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"summary" varchar NOT NULL,
  	"tool_name" varchar NOT NULL,
  	"status" "enum_ai_action_logs_status" DEFAULT 'pending' NOT NULL,
  	"conversation_id" varchar,
  	"requested_by_id" integer NOT NULL,
  	"changes" jsonb,
  	"result" jsonb,
  	"error" varchar,
  	"applied_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "products_videos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"video_type" "enum_products_videos_video_type" DEFAULT 'upload',
  	"video_file_id" integer,
  	"external_url" varchar,
  	"thumbnail_id" integer,
  	"is_vertical" boolean DEFAULT true
  );
  
  CREATE TABLE IF NOT EXISTS "_products_v_version_videos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"video_type" "enum__products_v_version_videos_video_type" DEFAULT 'upload',
  	"video_file_id" integer,
  	"external_url" varchar,
  	"thumbnail_id" integer,
  	"is_vertical" boolean DEFAULT true,
  	"_uuid" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"color_palette" "enum_site_settings_color_palette" DEFAULT 'warm',
  	"site_name" varchar DEFAULT 'SouGlowy',
  	"site_description" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rewards_enabled" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reward_points" numeric DEFAULT 0;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lifetime_points" numeric DEFAULT 0;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reward_tier_id" integer;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" varchar;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by_id" integer;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_count" numeric DEFAULT 0;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_check_in" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "check_in_streak" numeric DEFAULT 0;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birthday" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rewards_joined_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_complete" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "social_followed" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "_verified" boolean;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "_verificationtoken" varchar;
  ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "featured_in_video_showcase" boolean DEFAULT false;
  ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_featured_in_video_showcase" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "reward_tiers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "reward_transactions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "rewards_catalog_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "ai_action_logs_id" integer;
  DO $$ BEGIN
   ALTER TABLE "reward_tiers_benefits" ADD CONSTRAINT "reward_tiers_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reward_tiers"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "reward_transactions" ADD CONSTRAINT "reward_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "reward_transactions" ADD CONSTRAINT "reward_transactions_related_order_id_orders_id_fk" FOREIGN KEY ("related_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "reward_transactions" ADD CONSTRAINT "reward_transactions_related_reward_id_rewards_catalog_id_fk" FOREIGN KEY ("related_reward_id") REFERENCES "public"."rewards_catalog"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "rewards_catalog" ADD CONSTRAINT "rewards_catalog_free_product_id_products_id_fk" FOREIGN KEY ("free_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "rewards_catalog" ADD CONSTRAINT "rewards_catalog_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "rewards_catalog" ADD CONSTRAINT "rewards_catalog_minimum_tier_id_reward_tiers_id_fk" FOREIGN KEY ("minimum_tier_id") REFERENCES "public"."reward_tiers"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "ai_action_logs" ADD CONSTRAINT "ai_action_logs_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "products_videos" ADD CONSTRAINT "products_videos_video_file_id_media_id_fk" FOREIGN KEY ("video_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "products_videos" ADD CONSTRAINT "products_videos_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "products_videos" ADD CONSTRAINT "products_videos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "_products_v_version_videos" ADD CONSTRAINT "_products_v_version_videos_video_file_id_media_id_fk" FOREIGN KEY ("video_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "_products_v_version_videos" ADD CONSTRAINT "_products_v_version_videos_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "_products_v_version_videos" ADD CONSTRAINT "_products_v_version_videos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "reward_tiers_benefits_order_idx" ON "reward_tiers_benefits" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "reward_tiers_benefits_parent_id_idx" ON "reward_tiers_benefits" USING btree ("_parent_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "reward_tiers_slug_idx" ON "reward_tiers" USING btree ("slug");
  CREATE INDEX IF NOT EXISTS "reward_tiers_updated_at_idx" ON "reward_tiers" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "reward_tiers_created_at_idx" ON "reward_tiers" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "reward_transactions_user_idx" ON "reward_transactions" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "reward_transactions_related_order_idx" ON "reward_transactions" USING btree ("related_order_id");
  CREATE INDEX IF NOT EXISTS "reward_transactions_related_reward_idx" ON "reward_transactions" USING btree ("related_reward_id");
  CREATE INDEX IF NOT EXISTS "reward_transactions_updated_at_idx" ON "reward_transactions" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "reward_transactions_created_at_idx" ON "reward_transactions" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "rewards_catalog_free_product_idx" ON "rewards_catalog" USING btree ("free_product_id");
  CREATE INDEX IF NOT EXISTS "rewards_catalog_image_idx" ON "rewards_catalog" USING btree ("image_id");
  CREATE INDEX IF NOT EXISTS "rewards_catalog_minimum_tier_idx" ON "rewards_catalog" USING btree ("minimum_tier_id");
  CREATE INDEX IF NOT EXISTS "rewards_catalog_updated_at_idx" ON "rewards_catalog" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "rewards_catalog_created_at_idx" ON "rewards_catalog" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "ai_action_logs_status_idx" ON "ai_action_logs" USING btree ("status");
  CREATE INDEX IF NOT EXISTS "ai_action_logs_conversation_id_idx" ON "ai_action_logs" USING btree ("conversation_id");
  CREATE INDEX IF NOT EXISTS "ai_action_logs_requested_by_idx" ON "ai_action_logs" USING btree ("requested_by_id");
  CREATE INDEX IF NOT EXISTS "ai_action_logs_updated_at_idx" ON "ai_action_logs" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "ai_action_logs_created_at_idx" ON "ai_action_logs" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "products_videos_order_idx" ON "products_videos" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "products_videos_parent_id_idx" ON "products_videos" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "products_videos_video_file_idx" ON "products_videos" USING btree ("video_file_id");
  CREATE INDEX IF NOT EXISTS "products_videos_thumbnail_idx" ON "products_videos" USING btree ("thumbnail_id");
  CREATE INDEX IF NOT EXISTS "_products_v_version_videos_order_idx" ON "_products_v_version_videos" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_products_v_version_videos_parent_id_idx" ON "_products_v_version_videos" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_products_v_version_videos_video_file_idx" ON "_products_v_version_videos" USING btree ("video_file_id");
  CREATE INDEX IF NOT EXISTS "_products_v_version_videos_thumbnail_idx" ON "_products_v_version_videos" USING btree ("thumbnail_id");
  DO $$ BEGIN
   ALTER TABLE "users" ADD CONSTRAINT "users_reward_tier_id_reward_tiers_id_fk" FOREIGN KEY ("reward_tier_id") REFERENCES "public"."reward_tiers"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_id_users_id_fk" FOREIGN KEY ("referred_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reward_tiers_fk" FOREIGN KEY ("reward_tiers_id") REFERENCES "public"."reward_tiers"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reward_transactions_fk" FOREIGN KEY ("reward_transactions_id") REFERENCES "public"."reward_transactions"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rewards_catalog_fk" FOREIGN KEY ("rewards_catalog_id") REFERENCES "public"."rewards_catalog"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_action_logs_fk" FOREIGN KEY ("ai_action_logs_id") REFERENCES "public"."ai_action_logs"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "users_reward_tier_idx" ON "users" USING btree ("reward_tier_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_idx" ON "users" USING btree ("referral_code");
  CREATE INDEX IF NOT EXISTS "users_referred_by_idx" ON "users" USING btree ("referred_by_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_reward_tiers_id_idx" ON "payload_locked_documents_rels" USING btree ("reward_tiers_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_reward_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("reward_transactions_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_rewards_catalog_id_idx" ON "payload_locked_documents_rels" USING btree ("rewards_catalog_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_ai_action_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_action_logs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reward_tiers_benefits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reward_tiers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reward_transactions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rewards_catalog" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_action_logs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_videos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_version_videos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "reward_tiers_benefits" CASCADE;
  DROP TABLE "reward_tiers" CASCADE;
  DROP TABLE "reward_transactions" CASCADE;
  DROP TABLE "rewards_catalog" CASCADE;
  DROP TABLE "ai_action_logs" CASCADE;
  DROP TABLE "products_videos" CASCADE;
  DROP TABLE "_products_v_version_videos" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  ALTER TABLE "users" DROP CONSTRAINT "users_reward_tier_id_reward_tiers_id_fk";
  
  ALTER TABLE "users" DROP CONSTRAINT "users_referred_by_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reward_tiers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reward_transactions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_rewards_catalog_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_action_logs_fk";
  
  ALTER TABLE "transactions" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum_transactions_status";
  CREATE TYPE "public"."enum_transactions_status" AS ENUM('pending', 'succeeded', 'failed', 'cancelled', 'expired', 'refunded');
  ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."enum_transactions_status";
  ALTER TABLE "transactions" ALTER COLUMN "status" SET DATA TYPE "public"."enum_transactions_status" USING "status"::"public"."enum_transactions_status";
  DROP INDEX "users_reward_tier_idx";
  DROP INDEX "users_referral_code_idx";
  DROP INDEX "users_referred_by_idx";
  DROP INDEX "payload_locked_documents_rels_reward_tiers_id_idx";
  DROP INDEX "payload_locked_documents_rels_reward_transactions_id_idx";
  DROP INDEX "payload_locked_documents_rels_rewards_catalog_id_idx";
  DROP INDEX "payload_locked_documents_rels_ai_action_logs_id_idx";
  ALTER TABLE "users" DROP COLUMN "rewards_enabled";
  ALTER TABLE "users" DROP COLUMN "reward_points";
  ALTER TABLE "users" DROP COLUMN "lifetime_points";
  ALTER TABLE "users" DROP COLUMN "reward_tier_id";
  ALTER TABLE "users" DROP COLUMN "referral_code";
  ALTER TABLE "users" DROP COLUMN "referred_by_id";
  ALTER TABLE "users" DROP COLUMN "referral_count";
  ALTER TABLE "users" DROP COLUMN "last_check_in";
  ALTER TABLE "users" DROP COLUMN "check_in_streak";
  ALTER TABLE "users" DROP COLUMN "birthday";
  ALTER TABLE "users" DROP COLUMN "rewards_joined_at";
  ALTER TABLE "users" DROP COLUMN "profile_complete";
  ALTER TABLE "users" DROP COLUMN "social_followed";
  ALTER TABLE "users" DROP COLUMN "reset_password_requested_at";
  ALTER TABLE "users" DROP COLUMN "_verified";
  ALTER TABLE "users" DROP COLUMN "_verificationtoken";
  ALTER TABLE "products" DROP COLUMN "featured_in_video_showcase";
  ALTER TABLE "_products_v" DROP COLUMN "version_featured_in_video_showcase";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reward_tiers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reward_transactions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "rewards_catalog_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_action_logs_id";
  DROP TYPE "public"."enum_reward_transactions_type";
  DROP TYPE "public"."enum_reward_transactions_action";
  DROP TYPE "public"."enum_rewards_catalog_type";
  DROP TYPE "public"."enum_ai_action_logs_status";
  DROP TYPE "public"."enum_products_videos_video_type";
  DROP TYPE "public"."enum__products_v_version_videos_video_type";
  DROP TYPE "public"."enum_site_settings_color_palette";`)
}
