/**
 * Marks already-applied migrations as applied, WITHOUT running them.
 *
 * Why this exists
 * ---------------
 * Before migrations became authoritative, Payload's dev auto-push created the
 * schema in local databases (and wrote a `dev` marker row into
 * `payload_migrations`), so the migrations describing that schema were never
 * recorded as run. On such a database `payload migrate` tries to execute the
 * baseline and dies on the first `CREATE TYPE`, because the tables already
 * exist.
 *
 * This records the migrations whose effects are already present so that
 * `payload migrate` only has to apply what is genuinely new. It does NOT alter
 * any schema — it only writes bookkeeping rows.
 *
 * Safety: before marking anything, it checks the database actually has the
 * tables that migration creates. A pristine database therefore gets a clear
 * "run db:migrate instead" error rather than a silently wrong history.
 *
 * Usage:
 *   pnpm db:bootstrap                                # dry run (default)
 *   pnpm db:bootstrap --apply                        # write the rows
 *   pnpm db:bootstrap --upto 20260122_205052 --apply # only up to a name
 */

import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../src/payload.config'

/**
 * A fingerprint per migration, describing what it creates.
 *
 * Has to be table *and* column/type level, because a migration that ALTERs an
 * existing table (like adding a column) cannot be detected by looking for a
 * table alone — that table was created by an earlier migration. Deliberately
 * minimal rather than exhaustive: this answers "were the effects of this
 * migration applied", and the exhaustive check is the CI drift job, which
 * replays every migration from empty and asks whether it still matches config.
 */
type MigrationProbe = {
  columns?: Array<{ column: string; table: string }>
  tables?: string[]
  types?: string[]
}

const PROBES: Record<string, MigrationProbe> = {
  '20260122_205052': { tables: ['users'] },
  '20260930_172310_sync_schema_drift': {
    tables: ['ai_action_logs', 'brands', 'products'],
  },
  '20260930_184201_add_ai_action_kind': {
    columns: [{ column: 'kind', table: 'ai_action_logs' }],
    types: ['enum_ai_action_logs_kind'],
  },
}

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const uptoIndex = args.indexOf('--upto')
const upto = uptoIndex >= 0 ? args[uptoIndex + 1] : undefined

async function main() {
  const payload = await getPayload({ config })

  const existing = await appliedMigrationNames(payload)

  if (existing.size === 0) {
    throw new Error(
      'This database has no migration history at all, so it should not be bootstrapped. Run `pnpm db:migrate` to create the schema from the migrations.',
    )
  }

  const pending = Object.keys(PROBES)
    .filter((name) => !existing.has(name))
    .filter((name) => (upto ? name <= upto : true))
    .sort()

  if (pending.length === 0) {
    console.log('Nothing to do — every known migration is already recorded as applied.')
    process.exit(0)
  }

  // Next batch after the highest recorded one, so ordering stays meaningful.
  const batch = existing.size + 1

  /** Migrations left unmarked because their schema is not present yet. */
  const deferred: Array<{ missing: string[]; name: string }> = []

  for (const name of pending) {
    const missing = await missingEffects(payload, PROBES[name])

    if (missing.length > 0) {
      // Conservative on purpose: never record a migration whose effects are not
      // there. Leaving it unmarked means `pnpm db:migrate` will apply it for
      // real, which is what a database that is genuinely behind needs.
      deferred.push({ missing, name })
      continue
    }

    if (!apply) {
      console.log(`would mark as applied (batch ${batch}): ${name}`)
      continue
    }

    await payload.create({
      collection: 'payload-migrations',
      data: { batch, name },
    })

    console.log(`marked as applied (batch ${batch}): ${name}`)
  }

  // The `dev` row is what makes `payload migrate` stop and ask "you pushed in dev
  // mode, data loss may occur — proceed?" That prompt is fatal in CI, and it is
  // no longer true once this database has a real migration history.
  if (apply && existing.has('dev')) {
    await poolOf(payload).query("delete from payload_migrations where name = 'dev'")
    console.log('removed the dev-mode marker row (migrations are now the source of truth)')
  }

  if (deferred.length > 0) {
    console.log('\nNot marked — their schema is not present, so they still need to run:')
    for (const entry of deferred) {
      console.log(`  ${entry.name}  (missing: ${entry.missing.join(', ')})`)
    }
    console.log('Run `pnpm db:migrate` to apply those.')
  }

  if (!apply) {
    console.log('\nDry run — re-run with --apply to write these rows.')
  }

  process.exit(0)
}

/**
 * The adapter's node-postgres pool.
 *
 * `drizzle-orm` is not a direct dependency (pnpm's strict layout hides it), so
 * the pool is the honest way to run one-off introspection SQL from a script.
 */
type Pool = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}

const poolOf = (payload: Awaited<ReturnType<typeof getPayload>>) =>
  (payload.db as unknown as { pool: Pool }).pool

/** Names already recorded in payload_migrations. */
async function appliedMigrationNames(payload: Awaited<ReturnType<typeof getPayload>>) {
  const result = await poolOf(payload).query('select name from payload_migrations')

  return new Set(
    result.rows
      .map((row) => row.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0),
  )
}

/** Which of a migration's effects are absent from the public schema. */
async function missingEffects(
  payload: Awaited<ReturnType<typeof getPayload>>,
  probe: MigrationProbe,
): Promise<string[]> {
  const missing: string[] = []
  const pool = poolOf(payload)

  for (const table of probe.tables ?? []) {
    const result = await pool.query('select to_regclass($1) as reg', [`public.${table}`])
    if (!result.rows[0]?.reg) missing.push(`table ${table}`)
  }

  for (const name of probe.types ?? []) {
    const result = await pool.query('select to_regtype($1) as reg', [`public.${name}`])
    if (!result.rows[0]?.reg) missing.push(`type ${name}`)
  }

  for (const { column, table } of probe.columns ?? []) {
    const result = await pool.query(
      'select 1 from information_schema.columns where table_schema = $1 and table_name = $2 and column_name = $3',
      ['public', table, column],
    )
    if (result.rows.length === 0) missing.push(`column ${table}.${column}`)
  }

  return missing
}

void main()
