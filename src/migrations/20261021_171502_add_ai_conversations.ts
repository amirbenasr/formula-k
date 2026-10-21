import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "ai_conversations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"owner_id" integer NOT NULL,
  	"preview" varchar,
  	"message_count" numeric DEFAULT 0,
  	"last_message_at" timestamp(3) with time zone,
  	"messages" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_conversations_id" integer;
  ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "ai_conversations_key_idx" ON "ai_conversations" USING btree ("key");
  CREATE INDEX "ai_conversations_owner_idx" ON "ai_conversations" USING btree ("owner_id");
  CREATE INDEX "ai_conversations_last_message_at_idx" ON "ai_conversations" USING btree ("last_message_at");
  CREATE INDEX "ai_conversations_updated_at_idx" ON "ai_conversations" USING btree ("updated_at");
  CREATE INDEX "ai_conversations_created_at_idx" ON "ai_conversations" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_conversations_fk" FOREIGN KEY ("ai_conversations_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_ai_conversations_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_conversations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_conversations_fk";
  DROP INDEX "payload_locked_documents_rels_ai_conversations_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_conversations_id";
  DROP TABLE "ai_conversations" CASCADE;`)
}
