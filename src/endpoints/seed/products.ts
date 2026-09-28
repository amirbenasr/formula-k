import type { Payload } from 'payload'
import type { Product } from '@/payload-types'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Local, network-free fallback image shipped with the template.
 * Used only when the remote demo photos cannot be downloaded.
 */
const fallbackImagePath = path.resolve(dirname, 'tshirt-white.png')

const demoImages = [
  'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=900&q=80',
  'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=900&q=80',
  'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=900&q=80',
  'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=900&q=80',
  'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=900&q=80',
  'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=900&q=80',
]

const categories = [
  { title: 'Nettoyants', slug: 'nettoyants' },
  { title: 'Toniques', slug: 'toniques' },
  { title: 'Sérums', slug: 'serums' },
  { title: 'Crèmes', slug: 'cremes' },
  { title: 'Masques', slug: 'masques' },
  { title: 'Solaires', slug: 'solaires' },
]

const brands = [
  { title: 'Anua', slug: 'anua', description: 'Soins apaisants à base de heartleaf.' },
  {
    title: 'Beauty of Joseon',
    slug: 'beauty-of-joseon',
    description: 'Formules traditionnelles coréennes modernisées.',
  },
  { title: 'COSRX', slug: 'cosrx', description: 'Soins ciblés et ingrédients actifs.' },
]

type SeedProduct = {
  title: string
  slug: string
  brand: string
  categories: string[]
  price: number
  inventory: number
  description: string
  image: number
}

const products: SeedProduct[] = [
  {
    title: 'Nettoyant Doux Heartleaf',
    slug: 'nettoyant-doux-heartleaf',
    brand: 'anua',
    categories: ['nettoyants'],
    price: 45,
    inventory: 120,
    description: 'Un gel nettoyant doux au heartleaf qui apaise et nettoie sans dessécher.',
    image: 0,
  },
  {
    title: 'Huile Nettoyante Démaquillante',
    slug: 'huile-nettoyante-demaquillante',
    brand: 'anua',
    categories: ['nettoyants'],
    price: 52,
    inventory: 80,
    description: 'Élimine le maquillage et les impuretés tout en préservant la barrière cutanée.',
    image: 1,
  },
  {
    title: 'Tonique Exfoliant AHA/BHA',
    slug: 'tonique-exfoliant-aha-bha',
    brand: 'beauty-of-joseon',
    categories: ['toniques'],
    price: 48,
    inventory: 90,
    description: 'Un tonique léger qui lisse le grain de peau et affine le teint.',
    image: 2,
  },
  {
    title: 'Sérum Niacinamide 10%',
    slug: 'serum-niacinamide-10',
    brand: 'cosrx',
    categories: ['serums'],
    price: 65,
    inventory: 70,
    description: 'Réduit les pores et unifie le teint pour un effet glass skin.',
    image: 3,
  },
  {
    title: 'Sérum Vitamine C Éclat',
    slug: 'serum-vitamine-c-eclat',
    brand: 'cosrx',
    categories: ['serums'],
    price: 72,
    inventory: 60,
    description: 'Illumine, protège des agressions et atténue les taches.',
    image: 4,
  },
  {
    title: 'Crème Barrière Céramides',
    slug: 'creme-barriere-ceramides',
    brand: 'beauty-of-joseon',
    categories: ['cremes'],
    price: 78,
    inventory: 55,
    description: 'Hydratation intense et réparation de la barrière cutanée.',
    image: 5,
  },
  {
    title: 'Crème Snail Mucin 92%',
    slug: 'creme-snail-mucin-92',
    brand: 'cosrx',
    categories: ['cremes'],
    price: 85,
    inventory: 40,
    description: 'Répare, hydrate et donne un éclat naturel grâce à la mucine d’escargot.',
    image: 0,
  },
  {
    title: 'Masque Argile Purifiant',
    slug: 'masque-argile-purifiant',
    brand: 'anua',
    categories: ['masques'],
    price: 35,
    inventory: 100,
    description: 'Absorbe l’excès de sébum et resserre les pores.',
    image: 2,
  },
  {
    title: 'Écran Solaire Invisible SPF50+',
    slug: 'ecran-solaire-invisible-spf50',
    brand: 'beauty-of-joseon',
    categories: ['solaires'],
    price: 58,
    inventory: 130,
    description: 'Protection quotidienne légère, sans fini blanc ni film gras.',
    image: 3,
  },
]

type LexicalDescription = NonNullable<Product['description']>

function paragraph(text: string): LexicalDescription {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: [
        {
          type: 'paragraph',
          version: 1,
          format: '',
          indent: 0,
          direction: 'ltr',
          textFormat: 0,
          children: [
            {
              type: 'text',
              version: 1,
              text,
              format: 0,
              style: '',
              mode: 'normal',
              detail: 0,
            },
          ],
        },
      ],
    },
  }
}

async function uploadRemoteImage(
  payload: Payload,
  url: string,
  alt: string,
): Promise<number | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    const media = await payload.create({
      collection: 'media',
      data: { alt },
      file: {
        data: buffer,
        mimetype: contentType,
        name: `${alt.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.jpg`,
        size: buffer.length,
      },
    })

    return media.id
  } catch {
    return null
  }
}

async function uploadFallbackImage(payload: Payload, alt: string): Promise<number | null> {
  try {
    const buffer = fs.readFileSync(fallbackImagePath)
    const media = await payload.create({
      collection: 'media',
      data: { alt },
      file: {
        data: buffer,
        mimetype: 'image/png',
        name: `${alt.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`,
        size: buffer.length,
      },
    })
    return media.id
  } catch {
    return null
  }
}

async function findOrCreateCategory(
  payload: Payload,
  data: { title: string; slug: string },
): Promise<number | null> {
  const existing = await payload.find({
    collection: 'categories',
    where: { slug: { equals: data.slug } },
    limit: 1,
    depth: 0,
  })

  if (existing.docs.length > 0) {
    return existing.docs[0].id
  }

  const created = await payload.create({ collection: 'categories', data })
  return created.id
}

async function findOrCreateBrand(
  payload: Payload,
  data: { title: string; slug: string; description?: string },
): Promise<number | null> {
  const existing = await payload.find({
    collection: 'brands',
    where: { slug: { equals: data.slug } },
    limit: 1,
    depth: 0,
  })

  if (existing.docs.length > 0) {
    return existing.docs[0].id
  }

  const created = await payload.create({ collection: 'brands', data })
  return created.id
}

/**
 * Seeds a small demo catalog so the storefront has something to sell on first run.
 * Safe to call more than once: it bails out if any products already exist.
 */
export async function seedProducts(payload: Payload): Promise<void> {
  const { totalDocs } = await payload.count({ collection: 'products' })

  if (totalDocs > 0) {
    payload.logger.info(`Skipping product seed — ${totalDocs} products already exist.`)
    return
  }

  payload.logger.info('Seeding demo product catalog...')

  const categoryIds = new Map<string, number>()
  for (const category of categories) {
    const id = await findOrCreateCategory(payload, category)
    if (id !== null) categoryIds.set(category.slug, id)
  }

  const brandIds = new Map<string, number>()
  for (const brand of brands) {
    const id = await findOrCreateBrand(payload, brand)
    if (id !== null) brandIds.set(brand.slug, id)
  }

  // Upload each demo photo once and reuse it across products.
  const imageIds: number[] = []
  for (let i = 0; i < demoImages.length; i++) {
    const alt = `Produit de démonstration ${i + 1}`
    const id =
      (await uploadRemoteImage(payload, demoImages[i], alt)) ??
      (await uploadFallbackImage(payload, alt))
    imageIds.push(id ?? 0)
  }

  for (const product of products) {
    const brandId = brandIds.get(product.brand)
    const imageId = imageIds[product.image]

    if (!brandId || !imageId) {
      payload.logger.warn(`Skipping "${product.title}" — missing brand or image.`)
      continue
    }

    const categoryIdList = product.categories
      .map((slug) => categoryIds.get(slug))
      .filter((id): id is number => typeof id === 'number')

    await payload.create({
      collection: 'products',
      data: {
        title: product.title,
        slug: product.slug,
        description: paragraph(product.description),
        gallery: [{ image: imageId }],
        categories: categoryIdList,
        brand: brandId,
        priceInUSD: product.price,
        priceInUSDEnabled: true,
        inventory: product.inventory,
        enableVariants: false,
        _status: 'published',
      },
    })
  }

  payload.logger.info(`Seeded ${products.length} demo products.`)
}
