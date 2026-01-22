/**
 * Import scraped products into Payload CMS
 *
 * This script reads the scraped JSON data and imports it into Payload
 * using the local API.
 *
 * Usage:
 *   pnpm tsx scripts/import-to-payload.ts
 *
 * Prerequisites:
 *   - Run the scraper first: pnpm tsx scripts/scrape-anua.ts
 *   - Make sure your Payload server is running or use the local API
 */

// Load environment variables FIRST
import 'dotenv/config'

import * as fs from 'fs'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const INPUT_FILE = './scripts/output/anua-products.json'

interface ScrapedData {
  categories: Array<{ title: string; slug: string }>
  brand: { title: string; slug: string; description: string }
  products: Array<{
    title: string
    slug: string
    priceInUSD: number
    priceDinar: number
    description: string
    images: string[]
    categories: string[] // slugs
    brand: string // slug
    sourceUrl: string
    sku?: string
    _status: string
  }>
  metadata: {
    scrapedAt: string
    totalProducts: number
    conversionRate: number
  }
}

/**
 * Download image from URL and upload to Payload Media collection
 */
async function uploadImageFromUrl(
  payload: Awaited<ReturnType<typeof getPayload>>,
  imageUrl: string,
  altText: string,
): Promise<string | null> {
  try {
    console.log(`   📷 Downloading: ${imageUrl.substring(0, 60)}...`)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.log(`   ⚠️ Failed to download image: ${response.status}`)
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const extension = contentType.includes('png') ? 'png' : 'jpeg'
    const filename = `${altText.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.${extension}`

    // Create the media document
    const media = await payload.create({
      collection: 'media',
      data: {
        alt: altText,
      },
      file: {
        data: buffer,
        mimetype: contentType,
        name: filename,
        size: buffer.length,
      },
    })

    console.log(`   ✓ Uploaded: ${media.id}`)
    return media.id as any
  } catch (error) {
    console.error(`   ❌ Error uploading image:`, error)
    return null
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Starting Payload import...\n')

  // Check if input file exists
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`)
    console.log('💡 Run the scraper first: pnpm tsx scripts/scrape-anua.ts')
    process.exit(1)
  }

  // Read scraped data
  const rawData = fs.readFileSync(INPUT_FILE, 'utf-8')
  const data: ScrapedData = JSON.parse(rawData)

  console.log(`📊 Loaded ${data.products.length} products from scrape`)
  console.log(`📊 Found ${data.categories.length} categories`)
  console.log(`📊 Scraped at: ${data.metadata.scrapedAt}\n`)

  // Initialize Payload
  const payload = await getPayload({ config })

  // Track created IDs for relationships
  const categoryIdMap: Record<string, string> = {}
  let brandId: string | null = null

  // 1. Create or find brand
  console.log('🏷️ Creating brand...')
  try {
    // Check if brand exists
    const existingBrand = await payload.find({
      collection: 'brands',
      where: { slug: { equals: data.brand.slug } },
      limit: 1,
    })

    if (existingBrand.docs.length > 0) {
      brandId = existingBrand.docs[0].id as any
      console.log(`   ✓ Brand already exists: ${brandId}`)
    } else {
      const brand = await payload.create({
        collection: 'brands',
        data: {
          title: data.brand.title,
          slug: data.brand.slug,
          description: data.brand.description,
        },
      })
      brandId = brand.id as any
      console.log(`   ✓ Created brand: ${brandId}`)
    }
  } catch (error) {
    console.error('❌ Failed to create brand:', error)
    process.exit(1)
  }

  // 2. Create categories
  console.log('\n📂 Creating categories...')
  for (const category of data.categories) {
    try {
      // Check if category exists
      const existing = await payload.find({
        collection: 'categories',
        where: { slug: { equals: category.slug } },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        categoryIdMap[category.slug] = existing.docs[0].id as any
        console.log(`   ✓ Category exists: ${category.title} (${categoryIdMap[category.slug]})`)
      } else {
        const created = await payload.create({
          collection: 'categories',
          data: {
            title: category.title,
            slug: category.slug,
          },
        })
        categoryIdMap[category.slug] = created.id as any
        console.log(`   ✓ Created: ${category.title} (${categoryIdMap[category.slug]})`)
      }
    } catch (error) {
      console.error(`   ❌ Failed to create category ${category.title}:`, error)
    }
  }

  // 3. Create products
  console.log('\n📦 Creating products...')
  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (let i = 0; i < data.products.length; i++) {
    const product = data.products[i]
    console.log(`\n[${i + 1}/${data.products.length}] ${product.title}`)

    try {
      // Check if product already exists
      const existing = await payload.find({
        collection: 'products',
        where: { slug: { equals: product.slug } },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        console.log(`   ⏭️ Product already exists, skipping...`)
        skipCount++
        continue
      }

      // Upload images
      const galleryImages: Array<{ image: string }> = []
      for (let j = 0; j < Math.min(product.images.length, 5); j++) {
        // Max 5 images
        const mediaId = await uploadImageFromUrl(
          payload,
          product.images[j],
          `${product.title} ${j + 1}`,
        )
        if (mediaId) {
          galleryImages.push({ image: mediaId })
        }
      }

      if (galleryImages.length === 0) {
        console.log(`   ⚠️ No images could be uploaded, skipping product...`)
        errorCount++
        continue
      }

      // Map category slugs to IDs
      const categoryIds = product.categories
        .map((slug) => categoryIdMap[slug])
        .filter((id): id is string => id !== undefined)

      // Create the product
      await payload.create({
        collection: 'products',
        data: {
          title: product.title,
          slug: product.slug,
          priceInUSD: product.priceInUSD,
          gallery: galleryImages as any,
          categories: categoryIds as any,
          brand: brandId as any,
          _status: 'draft',
          // Note: description would need to be converted to Lexical format
          // For now, we'll skip it or you can add it manually
        },
      })

      console.log(`   ✅ Created product successfully`)
      successCount++
    } catch (error) {
      console.error(`   ❌ Failed to create product:`, error)
      errorCount++
    }

    // Small delay to avoid overwhelming the database
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 Import Summary')
  console.log('='.repeat(50))
  console.log(`✅ Successfully created: ${successCount} products`)
  console.log(`⏭️ Skipped (already exist): ${skipCount} products`)
  console.log(`❌ Failed: ${errorCount} products`)
  console.log(`🏷️ Brand ID: ${brandId}`)
  console.log(`📂 Categories created: ${Object.keys(categoryIdMap).length}`)
  console.log('='.repeat(50))

  process.exit(0)
}

main().catch((error) => {
  console.error('❌ Import failed:', error)
  process.exit(1)
})
