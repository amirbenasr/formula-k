import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Columns for the fields the S3/R2 storage plugin injects into upload
  // collections. Payload 3.90 added `_objectKey` (the per-upload folder segment)
  // and, with `alwaysInsertFields`, `prefix`; neither existed before, so every
  // media read on a database built from the older schema failed with
  // `column "_objectkey" does not exist` (42703).
  //
  // Deliberately idempotent: a database that already picked the columns up from
  // `DB_PUSH=true pnpm dev` with real R2 credentials is a no-op here, so the
  // migration still applies on every environment.
  await db.execute(sql`
   ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "prefix" varchar DEFAULT '';
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "_objectkey" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DROP COLUMN IF EXISTS "prefix";
  ALTER TABLE "media" DROP COLUMN IF EXISTS "_objectkey";`)
}
