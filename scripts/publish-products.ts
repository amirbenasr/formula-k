/**
 * Publish all draft products
 *
 * Usage: pnpm tsx scripts/publish-products.ts
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  console.log('🚀 Publishing all draft products...\n')

  const payload = await getPayload({ config })

  // Find all draft products
  const drafts = await payload.find({
    collection: 'products',
    where: {
      _status: { equals: 'draft' },
    },
    limit: 1000,
  })

  console.log(`📦 Found ${drafts.docs.length} draft products\n`)

  let published = 0
  for (const product of drafts.docs) {
    try {
      await payload.update({
        collection: 'products',
        id: product.id,
        data: {
          _status: 'published',
        },
      })
      console.log(`✅ Published: ${product.title}`)
      published++
    } catch (error) {
      console.error(`❌ Failed to publish ${product.title}:`, error)
    }
  }

  console.log(`\n✨ Done! Published ${published} products.`)
  process.exit(0)
}

main().catch((error) => {
  console.error('❌ Failed:', error)
  process.exit(1)
})
