/**
 * Olive Young - Anua Brand Scraper
 *
 * This script scrapes products from the Anua brand page on Olive Young
 * and prepares them for import into Payload CMS.
 *
 * Usage:
 *   pnpm scrape:anua
 *
 * Requirements:
 *   - pnpm install (tsx should be installed)
 *   - Playwright browsers: pnpm exec playwright install chromium
 */

import * as fs from 'fs'
import * as path from 'path'
import { chromium, type Page } from 'playwright'

// Configuration
const CONFIG = {
  brandPageUrl: 'https://global.oliveyoung.com/display/page/brand-page?brandNo=B00399',
  conversionRate: 2.92, // USD to Dinar
  outputDir: './scripts/output',
  outputFile: 'anua-products.json',
  delayBetweenRequests: 1500, // ms - be respectful to the server
}

interface ScrapedProduct {
  title: string
  priceUSD: number
  priceDinar: number
  description: string
  images: string[]
  url: string
  categories: string[]
}

/**
 * Wait for a random delay to mimic human behavior
 */
async function randomDelay(min = 1000, max = 2000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1) + min)
  await new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * Extract product URLs from the brand page
 */
async function getProductUrls(page: Page): Promise<string[]> {
  console.log('📦 Navigating to brand page...')
  // Use domcontentloaded instead of networkidle (site has constant network activity)
  await page.goto(CONFIG.brandPageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })

  // Wait for product items to load
  console.log('⏳ Waiting for products to load...')
  await page.waitForSelector('.product-unit', { timeout: 60000 })

  // Scroll to the bottom of the page first
  console.log('📜 Scrolling to bottom...')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await randomDelay(1000, 1500)

  // Click "More" button until all products are loaded
  console.log('🔄 Loading all products...')
  let moreButtonVisible = true
  let clickCount = 0

  while (moreButtonVisible) {
    const moreButton = await page.$('.product-list-more-btn')

    if (moreButton) {
      const isVisible = await moreButton.isVisible()
      if (isVisible) {
        console.log(`   Clicking "More" button (${++clickCount})...`)
        await moreButton.click()
        await randomDelay(1500, 2500) // Wait for new products to load
        // Scroll to bottom again to ensure button is visible if it still exists
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await randomDelay(500, 1000)
      } else {
        moreButtonVisible = false
      }
    } else {
      moreButtonVisible = false
    }
  }

  console.log('✅ All products loaded!')

  // Extract product URLs from .product-unit elements
  const productUrls = await page.evaluate(() => {
    const urls: string[] = []
    const productUnits = document.querySelectorAll('.product-unit')

    productUnits.forEach((unit) => {
      const link = unit.querySelector('a[href*="/product/detail"]')
      if (link) {
        const href = link.getAttribute('href')
        if (href) {
          const fullUrl = href.startsWith('http')
            ? href
            : `https://global.oliveyoung.com${href.startsWith('/') ? '' : '/'}${href}`
          if (!urls.includes(fullUrl)) {
            urls.push(fullUrl)
          }
        }
      }
    })

    return urls
  })

  console.log(`✅ Found ${productUrls.length} product URLs`)
  return productUrls
}

/**
 * Scrape a single product page
 */
async function scrapeProduct(page: Page, url: string): Promise<ScrapedProduct | null> {
  try {
    console.log(`\n🔍 Scraping: ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

    // Wait for product name to load
    await page.waitForSelector('dt[data-testid="product-name"]', { timeout: 30000 })
    await randomDelay(1000, 1500)

    const product = await page.evaluate(() => {
      // Extract title from dt[data-testid="product-name"]
      const titleEl = document.querySelector('dt[data-testid="product-name"]')
      const title = titleEl?.textContent?.trim() || ''

      // Extract price from the specific selector
      const priceEl = document.querySelector(
        '#prdtDetailApp > div.main > div.contents-sub > div.prd-detail-wrap > div.prd-detail-content > div.prd-price-info > dl > dd > span',
      )
      const priceText = priceEl?.textContent?.trim() || ''
      // Parse price - extract number from text like "$24.00" or "US$24.00"
      const priceMatch = priceText.match(/[\d,.]+/)
      const priceUSD = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0

      // Extract main image from #zoom_01
      const images: string[] = []
      const mainImg = document.querySelector('#zoom_01') as HTMLImageElement | null
      if (mainImg) {
        const src = mainImg.getAttribute('src') || mainImg.getAttribute('data-src')
        if (src) {
          const fullUrl = src.startsWith('http') ? src : `https:${src}`
          images.push(fullUrl)
        }
      }

      // Extract category from span.loc_cat
      const categories: string[] = []
      const categoryEl = document.querySelector('a span.loc_cat')
      if (categoryEl?.textContent) {
        const cat = categoryEl.textContent.trim()
        if (cat && cat.length > 2) {
          categories.push(cat)
        }
      }

      // Build description from multiple sections
      const descriptionParts: string[] = []

      // Why We Love It
      const whyWeLoveIt = document.querySelector('div[data-testid="product-whyweloveit-content"]')
      if (whyWeLoveIt?.textContent?.trim()) {
        descriptionParts.push(`**Why We Love It**\n${whyWeLoveIt.textContent.trim()}`)
      }

      // Featured Ingredients
      const featuredIngredients = document.querySelector(
        'div[data-testid="product-featuredingredients-content"]',
      )
      if (featuredIngredients?.textContent?.trim()) {
        descriptionParts.push(`**Featured Ingredients**\n${featuredIngredients.textContent.trim()}`)
      }

      // How To Use
      const howToUse = document.querySelector('div[data-testid="product-howtouse-content"]')
      if (howToUse?.textContent?.trim()) {
        descriptionParts.push(`**How To Use**\n${howToUse.textContent.trim()}`)
      }

      const description = descriptionParts.join('\n\n')

      return {
        title,
        priceUSD,
        description,
        images,
        categories,
      }
    })

    if (!product.title) {
      console.log('⚠️ Could not extract title, skipping...')
      return null
    }

    // Calculate dinar price
    const priceDinar = Math.round(product.priceUSD * CONFIG.conversionRate * 100) / 100

    console.log(`   ✓ Title: ${product.title}`)
    console.log(`   ✓ Price: $${product.priceUSD} USD = ${priceDinar} DT`)
    console.log(`   ✓ Category: ${product.categories.join(', ') || 'None'}`)
    console.log(`   ✓ Images: ${product.images.length}`)
    console.log(`   ✓ Description: ${product.description.length} chars`)

    return {
      ...product,
      priceDinar,
      url,
    }
  } catch (error) {
    console.error(`❌ Error scraping ${url}:`, error)
    return null
  }
}

/**
 * Generate slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * Convert scraped products to Payload-compatible format
 */
function toPayloadFormat(products: ScrapedProduct[]) {
  // Extract unique categories
  const allCategories = [...new Set(products.flatMap((p) => p.categories))]

  const categories = allCategories.map((title) => ({
    title,
    slug: generateSlug(title),
  }))

  // Convert products
  const payloadProducts = products.map((product) => ({
    title: product.title,
    slug: generateSlug(product.title),
    priceInUSD: product.priceUSD,
    priceDinar: product.priceDinar, // Custom field for your reference
    description: product.description,
    images: product.images, // URLs to download and upload to media
    categories: product.categories.map((cat) => generateSlug(cat)), // Will need to map to IDs
    brand: 'anua', // Will need to map to brand ID
    sourceUrl: product.url,
    _status: 'draft',
  }))

  return {
    categories,
    brand: {
      title: 'Anua',
      slug: 'anua',
      description: 'Korean skincare brand known for their heartleaf (Houttuynia Cordata) products',
    },
    products: payloadProducts,
    metadata: {
      scrapedAt: new Date().toISOString(),
      totalProducts: products.length,
      conversionRate: CONFIG.conversionRate,
    },
  }
}

/**
 * Main scraping function
 */
async function main() {
  console.log('🚀 Starting Anua product scraper...\n')

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true })
  }

  const browser = await chromium.launch({
    headless: false, // Set to true for production,
    timeout: 60000,
  })

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  })

  const page = await context.newPage()

  try {
    // Get all product URLs
    const productUrls = await getProductUrls(page)

    if (productUrls.length === 0) {
      console.log('❌ No products found. The page structure might have changed.')
      console.log('💡 Try running with headless: false to debug')
      return
    }

    // Scrape each product
    const products: ScrapedProduct[] = []

    for (let i = 0; i < productUrls.length; i++) {
      console.log(`\n[${i + 1}/${productUrls.length}]`)
      const product = await scrapeProduct(page, productUrls[i])

      if (product) {
        products.push(product)
      }

      // Respectful delay between requests
      if (i < productUrls.length - 1) {
        await randomDelay(CONFIG.delayBetweenRequests, CONFIG.delayBetweenRequests + 500)
      }
    }

    // Convert to Payload format and save
    const payloadData = toPayloadFormat(products)
    const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile)

    fs.writeFileSync(outputPath, JSON.stringify(payloadData, null, 2))

    console.log('\n' + '='.repeat(50))
    console.log('✅ Scraping complete!')
    console.log(`📁 Output saved to: ${outputPath}`)
    console.log(`📊 Total products scraped: ${products.length}`)
    console.log(`🏷️ Categories found: ${payloadData.categories.length}`)
    console.log('='.repeat(50))
  } catch (error) {
    console.error('❌ Scraping failed:', error)
  } finally {
    await browser.close()
  }
}

// Run the scraper
main().catch(console.error)
