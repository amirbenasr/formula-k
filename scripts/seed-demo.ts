/**
 * Seed a demo K-beauty catalog for local development.
 *
 *   pnpm seed:demo            # create/update the demo rows (idempotent)
 *   pnpm seed:demo --fresh    # delete the demo rows first, then reseed
 *
 * The real catalog lives in production (Neon). This script exists only so the
 * storefront can be developed and visually verified against a local Postgres
 * database that has the Payload schema but no rows.
 *
 * What it seeds:
 *   - 8 categories (French K-beauty routine steps)
 *   - 10 brands (logo reuses one of the demo photos)
 *   - 12 media documents from ~12 real skincare photos cached in .tmp/seed-images
 *   - 24 published products reusing those 12 photos
 *
 * Images: each photo is downloaded once into .tmp/seed-images/. If a download
 * fails, a generated placeholder JPEG is written to the same cache instead, so
 * the script never crashes and never leaves a broken media row.
 *
 * Idempotency: every row is looked up by its stable key (category/brand/product
 * slug, media alt) and updated in place when it already exists.
 */

// Load environment variables FIRST (same as the other scripts in this folder)
import 'dotenv/config'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import type { Payload } from 'payload'
import sharp from 'sharp'

import type { Product } from '../src/payload-types'

const filename = fileURLToPath(import.meta.url)
const ScriptDir = path.dirname(filename)
const RootDir = path.resolve(ScriptDir, '..')

const IMAGE_CACHE_DIR = path.resolve(RootDir, '.tmp', 'seed-images')
const FRESH = process.argv.includes('--fresh')

/* -------------------------------------------------------------------------- */
/* Slugs                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors Payload's own `slugify` (`val.replace(/ /g, '-').replace(/[^\w-]+/g, '').toLowerCase()`)
 * but first strips diacritics so French titles produce readable URLs
 * ("Sérums" -> "serums" instead of the raw slugify "srums").
 *
 * Slugs are always set explicitly, and updates pass `generateSlug: false`, so
 * the built-in slug hook never rewrites them.
 */
function makeSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
    .toLowerCase()
}

/* -------------------------------------------------------------------------- */
/* Demo content                                                                */
/* -------------------------------------------------------------------------- */

const DEMO_CATEGORIES = [
  'Nettoyants',
  'Toniques',
  'Sérums',
  'Essences',
  'Crèmes',
  'Masques',
  'Solaires',
  'Contour des Yeux',
].map((title) => ({ title, slug: makeSlug(title) }))

const DEMO_BRANDS = [
  {
    title: 'Anua',
    description: 'Marque coréenne minimaliste, connue pour sa ligne apaisante au heartleaf.',
  },
  {
    title: 'Beauty of Joseon',
    description: 'Formules inspirées de la cosmétique traditionnelle coréenne, à base de riz et de plantes.',
  },
  {
    title: 'COSRX',
    description: 'Soins ciblés aux actifs concentrés : mucine d’escargot, AHA/BHA, niacinamide.',
  },
  {
    title: 'Purito',
    description: 'Cosmétiques doux et propres, formulés autour de la centella asiatica.',
  },
  {
    title: 'Round Lab',
    description: 'Soins hydratants à l’eau de mer de Dokdo et aux ingrédients simples.',
  },
  {
    title: 'Isntree',
    description: 'Hydratation profonde à l’acide hyaluronique et à l’aloe vera.',
  },
  {
    title: 'Torriden',
    description: 'Spécialiste de l’acide hyaluronique 5D pour une hydratation multicouche.',
  },
  {
    title: 'Medicube',
    description: 'Dermo-cosmétique coréenne innovante, spécialiste du collagène.',
  },
  {
    title: 'Numbuzin',
    description: 'Sérums numérotés aux formules ultra-ciblées pour chaque besoin de peau.',
  },
  {
    title: 'SKIN1004',
    description: 'Soins apaisants à la centella asiatica de Madagascar.',
  },
].map((brand) => ({ ...brand, slug: makeSlug(brand.title) }))

type DemoProduct = {
  title: string
  brand: string // brand slug
  categories: string[] // category slugs
  price: number // TND, stored in priceInUSD
  inventory: number
  images: number[] // 0-based indices into the demo image pool
  description: string
  metaDescription: string
}

const DEMO_PRODUCTS_RAW: DemoProduct[] = [
  {
    title: 'Anua Tonique Apaisant Heartleaf 77%',
    brand: 'anua',
    categories: ['toniques'],
    price: 45,
    inventory: 24,
    images: [0],
    description:
      'Tonique quotidien enrichi à 77 % d’extrait de heartleaf : il apaise les rougeurs, rééquilibre le pH et prépare la peau aux soins suivants.',
    metaDescription:
      'Tonique apaisant Anua au heartleaf 77 % pour calmer les rougeurs. Livraison en Tunisie, paiement à la livraison.',
  },
  {
    title: 'Anua Nettoyant Moussant Heartleaf',
    brand: 'anua',
    categories: ['nettoyants'],
    price: 39,
    inventory: 18,
    images: [1],
    description:
      'Gel nettoyant doux au heartleaf qui élimine les impuretés et l’excès de sébum sans dessécher ni tirailler la peau.',
    metaDescription:
      'Nettoyant moussant Anua au heartleaf, doux et non desséchant. Commandez en Tunisie, paiement à la livraison.',
  },
  {
    title: 'Anua Sérum Heartleaf 80% Apaisant',
    brand: 'anua',
    categories: ['serums', 'essences'],
    price: 89,
    inventory: 4,
    images: [2, 3],
    description:
      'Sérum concentré à 80 % de heartleaf pour calmer les peaux sensibles, réduire les rougeurs et renforcer la barrière cutanée.',
    metaDescription:
      'Sérum apaisant Anua au heartleaf 80 % pour peaux sensibles. Livraison rapide en Tunisie, paiement à la livraison.',
  },
  {
    title: 'Beauty of Joseon Crème Riz Niacinamide',
    brand: 'beauty-of-joseon',
    categories: ['cremes'],
    price: 79,
    inventory: 32,
    images: [3],
    description:
      'Crème fondante au son de riz et à la niacinamide qui éclaircit le teint et maintient une hydratation durable.',
    metaDescription:
      'Crème Beauty of Joseon au riz et à la niacinamide pour un teint éclatant. Disponible en Tunisie, paiement à la livraison.',
  },
  {
    title: 'Beauty of Joseon Écran Solaire Relief Sun SPF50+',
    brand: 'beauty-of-joseon',
    categories: ['solaires'],
    price: 69,
    inventory: 45,
    images: [4],
    description:
      'Protection solaire SPF50+ PA++++ légère et hydratante, au fini naturel sans trace blanche.',
    metaDescription:
      'Écran solaire Beauty of Joseon Relief Sun SPF50+ sans trace blanche. Achetez en Tunisie, paiement à la livraison.',
  },
  {
    title: 'Beauty of Joseon Masque de Nuit au Riz',
    brand: 'beauty-of-joseon',
    categories: ['masques'],
    price: 49.9,
    inventory: 27,
    images: [5],
    description:
      'Masque de nuit nourrissant au riz qui réveille une peau reposée, lumineuse et rebondie.',
    metaDescription:
      'Masque de nuit au riz Beauty of Joseon pour une peau lumineuse au réveil. Livraison en Tunisie, paiement à la livraison.',
  },
  {
    title: 'COSRX Tonique Exfoliant AHA BHA',
    brand: 'cosrx',
    categories: ['toniques'],
    price: 59,
    inventory: 21,
    images: [6],
    description:
      'Tonique exfoliant doux aux AHA et BHA qui lisse le grain de peau, désincruste les pores et ravive l’éclat.',
    metaDescription:
      'Tonique exfoliant COSRX AHA BHA pour resserrer les pores et lisser la peau. Livraison en Tunisie, paiement à la livraison.',
  },
  {
    title: 'COSRX Crème Avancée Snail Mucin 92%',
    brand: 'cosrx',
    categories: ['cremes'],
    price: 89,
    inventory: 15,
    images: [7],
    description:
      'Crème réparatrice à 92 % de mucine d’escargot pour hydrater intensément et favoriser la régénération cellulaire.',
    metaDescription:
      'Crème COSRX Advanced Snail 92 % à la mucine d’escargot, réparatrice et hydratante. Paiement à la livraison en Tunisie.',
  },
  {
    title: 'COSRX Sérum Snail Mucin 96%',
    brand: 'cosrx',
    categories: ['serums'],
    price: 99,
    inventory: 3,
    images: [8],
    description:
      'Sérum ultra-concentré en mucine d’escargot qui répare, apaise et donne un effet glass skin immédiat.',
    metaDescription:
      'Sérum COSRX Advanced Snail 96 % à la mucine d’escargot pour un effet glass skin. Livraison en Tunisie.',
  },
  {
    title: 'Purito Sérum Centella Green Level',
    brand: 'purito',
    categories: ['serums'],
    price: 109,
    inventory: 12,
    images: [9],
    description:
      'Sérum apaisant à la centella asiatica qui calme les irritations et protège les peaux réactives.',
    metaDescription:
      'Sérum Purito Centella Green Level apaisant pour peaux réactives. Commandez en Tunisie, paiement à la livraison.',
  },
  {
    title: 'Purito Crème Barrière Centella',
    brand: 'purito',
    categories: ['cremes'],
    price: 85,
    inventory: 30,
    images: [10],
    description:
      'Crème barrière à la centella et aux céramides pour restaurer une peau fragilisée et retenir l’hydratation.',
    metaDescription:
      'Crème barrière Purito à la centella et aux céramides pour peau fragilisée. Livraison en Tunisie, paiement à la livraison.',
  },
  {
    title: 'Round Lab Tonique Dokdo 1025',
    brand: 'round-lab',
    categories: ['toniques'],
    price: 55,
    inventory: 0,
    images: [11],
    description:
      'Tonique hydratant à l’eau de mer de Dokdo et à l’acide hyaluronique pour une peau fraîche et repulpée.',
    metaDescription:
      'Tonique hydratant Round Lab Dokdo 1025 à l’eau de mer et acide hyaluronique. Livraison en Tunisie.',
  },
  {
    title: 'Round Lab Crème Hydratante Dokdo',
    brand: 'round-lab',
    categories: ['cremes'],
    price: 75,
    inventory: 40,
    images: [0, 11],
    description:
      'Crème hydratante riche en minéraux marins qui nourrit durablement et laisse un fini souple non gras.',
    metaDescription:
      'Crème hydratante Round Lab Dokdo aux minéraux marins, fini non gras. Achetez en Tunisie, paiement à la livraison.',
  },
  {
    title: 'Isntree Essence Tonique Hyaluronique',
    brand: 'isntree',
    categories: ['essences'],
    price: 65,
    inventory: 22,
    images: [1],
    description:
      'Essence tonique à huit acides hyaluroniques qui hydrate en profondeur et prépare la peau à absorber les soins.',
    metaDescription:
      'Essence tonique Isntree à l’acide hyaluronique pour une hydratation profonde. Livraison en Tunisie, paiement à la livraison.',
  },
  {
    title: 'Isntree Crème Gel Aloe Apaisante',
    brand: 'isntree',
    categories: ['cremes', 'masques'],
    price: 59.9,
    inventory: 0,
    images: [2],
    description:
      'Crème gel à l’aloe vera qui rafraîchit, apaise les coups de soleil et hydrate sans effet collant.',
    metaDescription:
      'Crème gel Isntree à l’aloe vera, apaisante et rafraîchissante. Commandez en Tunisie, paiement à la livraison.',
  },
  {
    title: 'Torriden Sérum Acide Hyaluronique 5D',
    brand: 'torriden',
    categories: ['serums'],
    price: 119,
    inventory: 17,
    images: [3],
    description:
      'Sérum aux cinq poids moléculaires d’acide hyaluronique pour une hydratation multicouche longue durée.',
    metaDescription:
      'Sérum Torriden 5D à l’acide hyaluronique pour une hydratation longue durée. Livraison en Tunisie.',
  },
  {
    title: 'Torriden Masque Hydratant Dive In',
    brand: 'torriden',
    categories: ['masques'],
    price: 29,
    inventory: 2,
    images: [4, 5],
    description:
      'Masque en tissu imbibé d’acide hyaluronique qui repulpe instantanément les peaux déshydratées.',
    metaDescription:
      'Masque hydratant Torriden Dive In à l’acide hyaluronique. Achetez en Tunisie, paiement à la livraison.',
  },
  {
    title: 'Medicube Masque Collagène de Nuit',
    brand: 'medicube',
    categories: ['masques'],
    price: 129,
    inventory: 26,
    images: [6],
    description:
      'Masque de nuit au collagène qui raffermit, lisse les ridules et réveille une peau rebondie.',
    metaDescription:
      'Masque de nuit au collagène Medicube pour raffermir et lisser la peau. Livraison en Tunisie, paiement à la livraison.',
  },
  {
    title: 'Medicube Crème Contour des Yeux Collagène',
    brand: 'medicube',
    categories: ['contour-des-yeux', 'cremes'],
    price: 139,
    inventory: 14,
    images: [7],
    description:
      'Soin contour des yeux au collagène qui atténue les ridules et les cernes tout en hydratant la zone délicate.',
    metaDescription:
      'Crème contour des yeux Medicube au collagène contre ridules et cernes. Livraison en Tunisie.',
  },
  {
    title: 'Numbuzin Sérum Vitamine C Éclat',
    brand: 'numbuzin',
    categories: ['serums'],
    price: 99.9,
    inventory: 19,
    images: [8],
    description:
      'Sérum éclat à la vitamine C stabilisée qui unifie le teint, atténue les taches et protège des agressions.',
    metaDescription:
      'Sérum Numbuzin à la vitamine C pour un teint unifié et éclatant. Commandez en Tunisie, paiement à la livraison.',
  },
  {
    title: 'Numbuzin Essence Tonique N°3',
    brand: 'numbuzin',
    categories: ['essences', 'toniques'],
    price: 89,
    inventory: 11,
    images: [9],
    description:
      'Essence tonique numéro 3 qui lisse, hydrate et prépare la peau pour un teint net et lumineux.',
    metaDescription:
      'Essence tonique Numbuzin n°3 pour lisser et hydrater la peau. Livraison en Tunisie, paiement à la livraison.',
  },
  {
    title: 'SKIN1004 Ampoule Centella Madagascar',
    brand: 'skin1004',
    categories: ['serums'],
    price: 149,
    inventory: 9,
    images: [10],
    description:
      'Ampoule pure à la centella asiatica de Madagascar qui apaise immédiatement les rougeurs et les irritations.',
    metaDescription:
      'Ampoule SKIN1004 à la centella de Madagascar, apaisante et anti-rougeurs. Livraison en Tunisie.',
  },
  {
    title: 'SKIN1004 Masque Apaisant Centella',
    brand: 'skin1004',
    categories: ['masques'],
    price: 25,
    inventory: 35,
    images: [11],
    description:
      'Masque apaisant à la centella pour calmer les peaux sensibles et restaurer le confort cutané.',
    metaDescription:
      'Masque apaisant SKIN1004 à la centella pour peaux sensibles. Achetez en Tunisie, paiement à la livraison.',
  },
  {
    title: 'SKIN1004 Crème Contour des Yeux Centella',
    brand: 'skin1004',
    categories: ['contour-des-yeux'],
    price: 189,
    inventory: 6,
    images: [0, 2],
    description:
      'Crème contour des yeux à la centella qui décongestionne, hydrate et lisse le regard.',
    metaDescription:
      'Crème contour des yeux SKIN1004 à la centella, décongestionnante. Livraison en Tunisie, paiement à la livraison.',
  },
]

const DEMO_PRODUCTS = DEMO_PRODUCTS_RAW.map((product) => ({
  ...product,
  slug: makeSlug(product.title),
}))

/**
 * Demo photos. Downloaded once into .tmp/seed-images and reused across products.
 * Portrait-ish product shots (bottles, jars, droppers, flat-lays).
 */
const DEMO_IMAGE_URLS = [
  'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=900&q=80&fm=jpg',
  'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=900&q=80&fm=jpg',
  'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=900&q=80&fm=jpg',
  'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=900&q=80&fm=jpg',
  'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=900&q=80&fm=jpg',
  'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=900&q=80&fm=jpg',
  'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=900&q=80&fm=jpg',
  'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=900&q=80&fm=jpg',
  'https://images.unsplash.com/photo-1612817288484-6f916006741a?w=900&q=80&fm=jpg',
  'https://images.unsplash.com/photo-1585652757141-8837d676fac8?w=900&q=80&fm=jpg',
  'https://images.unsplash.com/photo-1631730359585-38a4935cbec4?w=900&q=80&fm=jpg',
  'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?w=900&q=80&fm=jpg',
]

const mediaAlt = (index: number) => `Visuel démo Formula K ${index + 1}`
const imageFileName = (index: number) => `demo-${String(index + 1).padStart(2, '0')}.jpg`

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function log(message: string) {
  console.log(`\n▶ ${message}`)
}

type Stats = { created: number; updated: number }
const emptyStats = (): Stats => ({ created: 0, updated: 0 })

type LexicalParagraph = NonNullable<Product['description']>

function paragraph(text: string): LexicalParagraph {
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

/* -------------------------------------------------------------------------- */
/* Images                                                                      */
/* -------------------------------------------------------------------------- */

const PLACEHOLDER_COLORS = [
  { r: 244, g: 232, b: 223 },
  { r: 232, g: 240, b: 235 },
  { r: 240, g: 234, b: 246 },
  { r: 250, g: 242, b: 230 },
]

/** Simple, font-free placeholder so a failed download still yields a valid JPEG. */
async function writePlaceholderImage(dest: string, index: number): Promise<void> {
  const background = PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length]
  const svg = `<svg width="900" height="900" xmlns="http://www.w3.org/2000/svg">
    <circle cx="450" cy="420" r="240" fill="rgba(255,255,255,0.55)" />
    <rect x="330" y="640" width="240" height="56" rx="16" fill="rgba(0,0,0,0.08)" />
  </svg>`

  await sharp({ create: { width: 900, height: 900, channels: 3, background } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 82 })
    .toFile(dest)
}

async function downloadImage(url: string, dest: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(25000),
      headers: { 'user-agent': 'formula-k-seed/1.0' },
    })
    if (!response.ok) return false

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return false

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length < 2048) return false

    // Decode before writing: a corrupt/non-image payload would break the upload.
    await sharp(buffer).metadata()

    // Uint8Array.from keeps @types/node happy (Buffer vs. lib.es5 ArrayBufferView).
    fs.writeFileSync(dest, Uint8Array.from(buffer))
    return true
  } catch {
    return false
  }
}

/** Ensures the ~12 demo photos are cached on disk, downloading or faking each once. */
async function ensureCachedImages(): Promise<string[]> {
  fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true })

  const files: string[] = []
  let downloaded = 0
  let placeholders = 0
  let cached = 0

  for (let i = 0; i < DEMO_IMAGE_URLS.length; i++) {
    const file = path.join(IMAGE_CACHE_DIR, imageFileName(i))

    if (fs.existsSync(file) && fs.statSync(file).size > 2048) {
      cached++
      files.push(file)
      continue
    }

    if (await downloadImage(DEMO_IMAGE_URLS[i], file)) {
      downloaded++
      files.push(file)
      continue
    }

    console.warn(`  ⚠ Téléchargement impossible, placeholder généré : ${path.basename(file)}`)
    await writePlaceholderImage(file, i)
    placeholders++
    files.push(file)
  }

  console.log(
    `  Images en cache : ${files.length} (${downloaded} téléchargées, ${cached} déjà présentes, ${placeholders} placeholders)`,
  )
  return files
}

/** Finds or creates the media rows for the cached photos. */
async function seedDemoMedia(
  payload: Payload,
): Promise<{ ids: number[]; created: number; reused: number }> {
  const files = await ensureCachedImages()
  const ids: number[] = []
  let created = 0
  let reused = 0

  for (let i = 0; i < files.length; i++) {
    const alt = mediaAlt(i)
    const existing = await payload.find({
      collection: 'media',
      where: { alt: { equals: alt } },
      limit: 1,
      depth: 0,
    })

    if (existing.docs.length > 0) {
      ids.push(existing.docs[0].id)
      reused++
      continue
    }

    const media = await payload.create({
      collection: 'media',
      data: { alt },
      filePath: files[i],
    })
    ids.push(media.id)
    created++
  }

  return { ids, created, reused }
}

/* -------------------------------------------------------------------------- */
/* Categories / brands / products                                              */
/* -------------------------------------------------------------------------- */

async function seedCategories(payload: Payload): Promise<{ ids: Map<string, number>; stats: Stats }> {
  const ids = new Map<string, number>()
  const stats = emptyStats()

  for (const category of DEMO_CATEGORIES) {
    const data = { title: category.title, slug: category.slug, generateSlug: false }
    const existing = await payload.find({
      collection: 'categories',
      where: { slug: { equals: category.slug } },
      limit: 1,
      depth: 0,
    })

    if (existing.docs.length > 0) {
      const doc = await payload.update({ collection: 'categories', id: existing.docs[0].id, data })
      ids.set(category.slug, doc.id)
      stats.updated++
    } else {
      const doc = await payload.create({ collection: 'categories', data })
      ids.set(category.slug, doc.id)
      stats.created++
    }
  }

  return { ids, stats }
}

async function seedBrands(
  payload: Payload,
  imageIds: number[],
): Promise<{ ids: Map<string, number>; stats: Stats }> {
  const ids = new Map<string, number>()
  const stats = emptyStats()

  for (let i = 0; i < DEMO_BRANDS.length; i++) {
    const brand = DEMO_BRANDS[i]
    const data = {
      title: brand.title,
      slug: brand.slug,
      description: brand.description,
      logo: imageIds[i % imageIds.length],
      generateSlug: false,
    }
    const existing = await payload.find({
      collection: 'brands',
      where: { slug: { equals: brand.slug } },
      limit: 1,
      depth: 0,
    })

    if (existing.docs.length > 0) {
      const doc = await payload.update({ collection: 'brands', id: existing.docs[0].id, data })
      ids.set(brand.slug, doc.id)
      stats.updated++
    } else {
      const doc = await payload.create({ collection: 'brands', data })
      ids.set(brand.slug, doc.id)
      stats.created++
    }
  }

  return { ids, stats }
}

async function seedProducts(
  payload: Payload,
  refs: { categoryIds: Map<string, number>; brandIds: Map<string, number>; imageIds: number[] },
): Promise<Stats> {
  const stats = emptyStats()

  for (const product of DEMO_PRODUCTS) {
    const brandId = refs.brandIds.get(product.brand)
    if (!brandId) {
      throw new Error(`Unknown brand "${product.brand}" for product "${product.title}"`)
    }

    const categoryIds = product.categories
      .map((slug) => refs.categoryIds.get(slug))
      .filter((id): id is number => typeof id === 'number')

    const gallery = product.images.map((index) => ({ image: refs.imageIds[index] }))

    // Note: `brand` is a real required relationship on the products collection.
    // `featuredInVideoShowcase` / `videos` are intentionally left untouched.
    const data = {
      title: product.title,
      slug: product.slug,
      description: paragraph(product.description),
      gallery,
      categories: categoryIds,
      brand: brandId,
      priceInUSD: product.price,
      priceInUSDEnabled: true,
      inventory: product.inventory,
      enableVariants: false,
      generateSlug: false,
      meta: { title: `${product.title} | Formula K`, description: product.metaDescription },
      _status: 'published' as const,
    }

    const existing = await payload.find({
      collection: 'products',
      where: { slug: { equals: product.slug } },
      limit: 1,
      depth: 0,
    })

    if (existing.docs.length > 0) {
      await payload.update({ collection: 'products', id: existing.docs[0].id, data })
      stats.updated++
    } else {
      await payload.create({ collection: 'products', data })
      stats.created++
    }
  }

  return stats
}

/* -------------------------------------------------------------------------- */
/* --fresh                                                                     */
/* -------------------------------------------------------------------------- */

/** Hard-deletes the rows this script owns (matched by slug/alt). */
async function purgeDemoRows(payload: Payload) {
  const deletedProducts = await payload.delete({
    collection: 'products',
    where: { slug: { in: DEMO_PRODUCTS.map((p) => p.slug) } },
    trash: true,
  })
  const deletedBrands = await payload.delete({
    collection: 'brands',
    where: { slug: { in: DEMO_BRANDS.map((b) => b.slug) } },
    trash: true,
  })
  const deletedCategories = await payload.delete({
    collection: 'categories',
    where: { slug: { in: DEMO_CATEGORIES.map((c) => c.slug) } },
    trash: true,
  })
  const deletedMedia = await payload.delete({
    collection: 'media',
    where: { alt: { in: DEMO_IMAGE_URLS.map((_, i) => mediaAlt(i)) } },
    trash: true,
  })

  console.log(
    `  Supprimés : ${deletedProducts.docs.length} produits, ${deletedBrands.docs.length} marques, ${deletedCategories.docs.length} catégories, ${deletedMedia.docs.length} médias`,
  )
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The template's .env/.env.example ship placeholder R2_* values (e.g.
 * "your-bucket-name", "https://<account-id>.r2.cloudflarestorage.com"). Any
 * non-empty value enables the S3 storage plugin, which then fails on the bogus
 * endpoint. When the local config is clearly a placeholder, drop it before
 * Payload is loaded so media falls back to local disk (public/media) instead.
 * Real R2 credentials are left untouched.
 */
function disablePlaceholderR2Config() {
  const values = [
    process.env.R2_BUCKET,
    process.env.R2_ENDPOINT,
    process.env.R2_ACCESS_KEY_ID,
    process.env.R2_SECRET_ACCESS_KEY,
  ]
  const isPlaceholder = values.some((value) => value && (value.includes('<') || value.includes('your-')))

  if (!isPlaceholder) return

  delete process.env.R2_BUCKET
  delete process.env.R2_ENDPOINT
  delete process.env.R2_ACCESS_KEY_ID
  delete process.env.R2_SECRET_ACCESS_KEY
  console.warn(
    '  ⚠ Configuration R2 détectée comme un placeholder — stockage local (public/media) utilisé pour ce seed.',
  )
}

async function main() {
  console.log(
    FRESH
      ? '🧹 Seed démo Formula K (--fresh : suppression puis recréation)'
      : '🌱 Seed démo Formula K (idempotent)',
  )

  disablePlaceholderR2Config()

  // Imported dynamically so the placeholder R2 guard runs before the config reads env vars.
  const { default: config } = await import('../src/payload.config')
  const { getPayload } = await import('payload')
  const payload = await getPayload({ config })

  if (FRESH) {
    log('Suppression des lignes de démo existantes')
    await purgeDemoRows(payload)
  }

  log('Médias')
  const media = await seedDemoMedia(payload)

  log('Catégories')
  const categories = await seedCategories(payload)

  log('Marques')
  const brands = await seedBrands(payload, media.ids)

  log('Produits')
  const products = await seedProducts(payload, {
    categoryIds: categories.ids,
    brandIds: brands.ids,
    imageIds: media.ids,
  })

  console.log('\n' + '='.repeat(52))
  console.log('📊 Résumé du seed démo')
  console.log('='.repeat(52))
  console.log(`Catégories : ${categories.stats.created} créées, ${categories.stats.updated} mises à jour`)
  console.log(`Marques    : ${brands.stats.created} créées, ${brands.stats.updated} mises à jour`)
  console.log(`Médias     : ${media.created} créés, ${media.reused} réutilisés`)
  console.log(`Produits   : ${products.created} créés, ${products.updated} mis à jour`)
  console.log('='.repeat(52))

  process.exit(0)
}

main().catch((error) => {
  console.error('\n✖ Seed démo échoué :', error instanceof Error ? error.message : error)
  process.exit(1)
})
