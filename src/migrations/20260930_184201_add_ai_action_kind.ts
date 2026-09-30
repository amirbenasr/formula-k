import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ai_action_logs_kind" AS ENUM('inventory', 'product', 'brand');
  ALTER TABLE "ai_action_logs" ADD COLUMN "kind" "enum_ai_action_logs_kind" DEFAULT 'inventory' NOT NULL;
  CREATE INDEX "ai_action_logs_kind_idx" ON "ai_action_logs" USING btree ("kind");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "ai_action_logs_kind_idx";
  ALTER TABLE "ai_action_logs" DROP COLUMN "kind";
  DROP TYPE "public"."enum_ai_action_logs_kind";`)
}
