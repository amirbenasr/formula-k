/**
 * One-command local setup for Formula K.
 *
 *   pnpm setup
 *
 * - creates .env from .env.example (and generates PAYLOAD_SECRET)
 * - starts the docker-compose Postgres (if Docker is available)
 * - lets Payload push the schema on first use
 * - seeds a demo product catalog so the storefront is not empty
 *
 * Note: local development uses Payload's schema push. The checked-in migration
 * predates the Rewards collections, so `payload migrate` alone would produce an
 * incomplete schema — migrations are for production only and need regeneration.
 */
import { execSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import dotenv from 'dotenv'

const filename = fileURLToPath(import.meta.url)
const ScriptDir = path.dirname(filename)
const RootDir = path.resolve(ScriptDir, '..')

const ENV_FILE = path.join(RootDir, '.env')
const ENV_EXAMPLE = path.join(RootDir, '.env.example')

function log(message: string) {
  console.log(`\n▶ ${message}`)
}

function ensureEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    if (!fs.existsSync(ENV_EXAMPLE)) {
      throw new Error('Missing .env.example — cannot create .env')
    }
    fs.copyFileSync(ENV_EXAMPLE, ENV_FILE)
    log('Created .env from .env.example')
  }

  let contents = fs.readFileSync(ENV_FILE, 'utf8')
  if (contents.includes('PAYLOAD_SECRET=mygeneratedsecret')) {
    const secret = crypto.randomBytes(32).toString('hex')
    contents = contents.replace('PAYLOAD_SECRET=mygeneratedsecret', `PAYLOAD_SECRET=${secret}`)
    fs.writeFileSync(ENV_FILE, contents)
    log('Generated PAYLOAD_SECRET')
  }
}

function run(command: string, options: { allowFailure?: boolean } = {}) {
  try {
    execSync(command, { cwd: RootDir, stdio: 'inherit' })
  } catch (error) {
    if (options.allowFailure) return false
    throw error
  }
  return true
}

function startDatabase() {
  const candidates = ['docker compose', 'docker-compose']
  for (const candidate of candidates) {
    if (run(`${candidate} version`, { allowFailure: true })) {
      log('Starting Postgres with Docker Compose')
      if (!run(`${candidate} up -d --wait`, { allowFailure: true })) {
        console.warn(
          '\n⚠ Could not start Docker Compose (is port 5432 already in use?). Continuing — make sure DATABASE_URL in .env points to a reachable Postgres instance.',
        )
      }
      return
    }
  }
  console.warn(
    '\n⚠ Docker was not found. Skipping database startup — make sure DATABASE_URL in .env points to a reachable Postgres instance.',
  )
}

async function seed() {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const { seedProducts } = await import('../src/endpoints/seed/products')

  log('Seeding demo catalog')
  const payload = await getPayload({ config })
  await seedProducts(payload)
}

async function main() {
  ensureEnvFile()
  // Load the (possibly just created) .env before anything reads process.env
  dotenv.config({ path: ENV_FILE })

  startDatabase()

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Configure it in .env and re-run `pnpm setup`.')
  }

  await seed()

  log('Setup complete — run `pnpm dev` and open http://localhost:3000')
}

main().catch((error) => {
  console.error('\n✖ Setup failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
