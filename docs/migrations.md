# Database migrations

Migrations are the **source of truth** for the schema. The database is changed by
running them, and nothing else changes it.

---

## Why this needed fixing

Payload's Postgres adapter pushes the schema straight to the database whenever it
starts outside production:

```js
// @payloadcms/db-postgres/dist/connect.js
if (process.env.NODE_ENV !== 'production' && process.env.PAYLOAD_MIGRATING !== 'true' && this.push !== false)
  await pushDevSchema(this)
```

That convenience caused two problems here:

1. **Nothing was ever tracked.** Because development never ran a migration, no
   migration file described the schema a developer was actually using. The
   collection changes lived only in one person's local database.
2. **Dev and production forked.** Production does *not* push; it runs migrations.
   So a collection added locally simply did not exist in production, and there was
   no file that would have created it.

It also left a `dev` marker row (`batch = -1`) in `payload_migrations`, which means
`payload migrate` stops and asks *"you've dynamically pushed changes, data loss will
occur — proceed?"*. In CI that prompt hangs forever.

`push` is now off. Opt in only when you are mid-iteration and do not want a
migration per save:

```bash
DB_PUSH=true pnpm dev
```

Before you merge, generate a migration for whatever you changed.

---

## The normal loop

```bash
# 1. Change a collection, then regenerate types and write a migration
pnpm generate:types
pnpm db:migrate:create add_gift_wrapping

# 2. Apply it to your database
pnpm db:migrate

# 3. Commit the collection change AND src/migrations/*
```

`pnpm db:migrate:create` diffs the Drizzle schema against the snapshots committed
in `src/migrations/`. It needs no database connection.

Other commands:

| Command | Purpose |
| --- | --- |
| `pnpm db:migrate` | Apply every pending migration to `DATABASE_URL` |
| `pnpm db:migrate:status` | Show which migrations have and have not run |
| `pnpm db:migrate:create <name>` | Generate a migration from a schema change |
| `pnpm db:bootstrap` | Adopt an existing push-created schema (below) |

---

## Adopting a database that was created by push

A database whose schema came from `pushDevSchema` has tables but no migration
history. `payload migrate` cannot run the baseline against it — it fails with
`type "enum_users_roles" already exists`, because the baseline builds a whole
schema from nothing.

`db:bootstrap` records the migrations whose effects are already present, so
`payload migrate` only has to apply what is genuinely new:

```bash
pnpm db:bootstrap                    # dry run — shows what it would mark
pnpm db:bootstrap --apply
pnpm db:migrate                      # apply whatever is actually missing
```

It is conservative by design. Before marking a migration it checks that the schema
that migration produces is really there (tables, columns and enum types). Anything
whose effects are **not** present is left unmarked and reported, so it still runs
for real:

```
marked as applied (batch 2): 20260122_205052
Not marked — their schema is not present, so they still need to run:
  20260930_184201_add_ai_action_kind  (missing: type enum_ai_action_logs_kind, column ai_action_logs.kind)
Run `pnpm db:migrate` to apply those.
```

It also deletes the stale `dev` marker row, which is what stops `payload migrate`
from blocking on a prompt in CI.

On a **pristine** database it refuses and tells you to run `pnpm db:migrate`
instead, because bootstrapping an empty database would produce a wrong history.

---

## CI/CD

`.github/workflows/database.yml` has two jobs:

**`verify`** — every PR. Runs `typecheck`, `test:unit`, then
`pnpm db:migrate:create` with no database. If that produces a migration file, a
collection changed without a migration and the job fails:

> A collection changed without a migration.
> Run `pnpm db:migrate:create <name>` and commit the result.

**`migrate`** — only on merge to `main` (or a manual run from the Actions tab).
Applies pending migrations to the database in `DATABASE_URL`. PRs can never write
to production, and the job points at the `production` GitHub Environment so the
run is recorded — add required reviewers there if you want an approval gate.

Concurrency is set so two migration runs can never overlap; two `payload migrate`
processes racing on one database is how a history gets corrupted.

### One-time setup

Add these in **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `DATABASE_URL` | The production Postgres connection string |
| Secret | `PAYLOAD_SECRET` | The production `PAYLOAD_SECRET` |
| Variable | `DB_SSL` | `false` only for a local/self-hosted DB; omit for managed Postgres |

Until `DATABASE_URL` exists the `migrate` job fails loudly with a message saying so,
rather than silently doing nothing.

### Adopting production the first time

Production's schema already exists (it was created before migrations were wired
up), so its first run needs the bootstrap, once, against production:

```bash
DATABASE_URL="<production url>" pnpm db:bootstrap          # review the dry run
DATABASE_URL="<production url>" pnpm db:bootstrap --apply
DATABASE_URL="<production url>" pnpm db:migrate
```

After that, merges to `main` keep it current on their own.

---

## Two rules worth remembering

1. **Never hand-edit an applied migration.** Payload stores a checksum-verified
   snapshot chain; write a new migration instead.
2. **A migration that has run in production is immutable.** It is a historical
   record of what was done, not documentation to tidy up later.
