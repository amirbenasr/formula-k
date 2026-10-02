import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_competitor_prices_match_confidence" AS ENUM('exact', 'likely', 'uncertain');
  CREATE TYPE "public"."enum_competitor_prices_fetch_method" AS ENUM('serpapi', 'manual');
  CREATE TABLE "competitor_prices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"product_id" integer NOT NULL,
  	"source" varchar NOT NULL,
  	"title" varchar,
  	"url" varchar,
  	"competitor_price" numeric NOT NULL,
  	"raw_price_text" varchar,
  	"previous_price" numeric,
  	"price_changed_at" timestamp(3) with time zone,
  	"match_confidence" "enum_competitor_prices_match_confidence" DEFAULT 'likely',
  	"ignored" boolean DEFAULT false,
  	"fetched_at" timestamp(3) with time zone,
  	"fetch_method" "enum_competitor_prices_fetch_method" DEFAULT 'serpapi',
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "competitor_prices_id" integer;
  ALTER TABLE "competitor_prices" ADD CONSTRAINT "competitor_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "competitor_prices_label_idx" ON "competitor_prices" USING btree ("label");
  CREATE INDEX "competitor_prices_product_idx" ON "competitor_prices" USING btree ("product_id");
  CREATE INDEX "competitor_prices_source_idx" ON "competitor_prices" USING btree ("source");
  CREATE INDEX "competitor_prices_ignored_idx" ON "competitor_prices" USING btree ("ignored");
  CREATE INDEX "competitor_prices_updated_at_idx" ON "competitor_prices" USING btree ("updated_at");
  CREATE INDEX "competitor_prices_created_at_idx" ON "competitor_prices" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_competitor_prices_fk" FOREIGN KEY ("competitor_prices_id") REFERENCES "public"."competitor_prices"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_competitor_prices_id_idx" ON "payload_locked_documents_rels" USING btree ("competitor_prices_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "competitor_prices" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "competitor_prices" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_competitor_prices_fk";
  
  DROP INDEX "payload_locked_documents_rels_competitor_prices_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "competitor_prices_id";
  DROP TYPE "public"."enum_competitor_prices_match_confidence";
  DROP TYPE "public"."enum_competitor_prices_fetch_method";`)
}
