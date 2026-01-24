import { VideoShowcase } from '@/components/VideoShowcase'
import config from '@payload-config'
import { ArrowRight, Droplets, Heart, Sparkles, Sun } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { getPayload } from 'payload'

export const metadata = {
  title: 'SouGlowy | K-Beauty Tunisia',
  description:
    'Discover the secret to Glass Skin. The best K-Beauty products selected to reveal your natural glow.',
}

export default async function HomePage() {
  const payload = await getPayload({ config })

  const { docs: brands } = await payload.find({
    collection: 'brands',
    limit: 10,
  })

  // Fetch products featured in video showcase
  const { docs: allVideoShowcaseProducts } = await payload.find({
    collection: 'products',
    where: {
      featuredInVideoShowcase: {
        equals: true,
      },
    },
    limit: 20,
    depth: 2,
  })

  // Filter to only include products that have videos
  const videoShowcaseProducts = allVideoShowcaseProducts.filter(
    (product) => product.videos && product.videos.length > 0,
  )

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-secondary/50 to-background overflow-hidden">
        <div className="container py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <span className="badge-new mb-4">K-Beauty Tunisia</span>
              <h1 className="text-4xl lg:text-6xl font-serif font-bold text-foreground mb-6 leading-tight">
                Découvrez le Secret de la Glass Skin
              </h1>
              <p className="text-lg text-muted mb-8 max-w-lg mx-auto lg:mx-0">
                Les meilleurs produits K-Beauty sélectionnés pour révéler votre éclat naturel
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/products" className="btn-primary">
                  Découvrir
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link href="/routines" className="btn-outline">
                  Voir les Routines
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="relative aspect-[4/5] max-w-md mx-auto lg:max-w-lg">
                <div className="absolute inset-0 bg-primary/20 rounded-[2rem] blur-3xl" />
                <Image
                  src="https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=600&h=750&fit=crop"
                  alt="K-Beauty Products"
                  fill
                  className="object-cover rounded-[2rem] relative z-10"
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-accent/20 rounded-full blur-2xl" />
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
      </section>

      {/* Features */}
      <section className="py-12 border-b border-gray-100 dark:border-border">
        <div className="container">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Sparkles, title: 'Glass Skin', desc: 'Eclat radieux' },
              { icon: Droplets, title: 'Hydratation', desc: 'Couches de moisture' },
              { icon: Sun, title: 'Protection', desc: 'Essentiels SPF' },
              { icon: Heart, title: 'Soin Doux', desc: 'Peaux sensibles' },
            ].map((feature, i) => (
              <div key={i} className="text-center p-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-3">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-serif font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-muted">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Showcase Section */}
      {videoShowcaseProducts.length > 0 && <VideoShowcase products={videoShowcaseProducts} />}

      {/* Featured Products Placeholder */}
      <section className="py-16">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl lg:text-3xl font-serif font-bold">Produits Vedettes</h2>
            <Link
              href="/products"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Voir tout
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="text-center py-12 bg-secondary/20 rounded-soft">
            <p className="text-muted mb-4">
              Pas encore de produits. Ajoutez des produits dans le panneau admin.
            </p>
            <Link href="/admin" className="btn-primary">
              Aller à l&apos;Admin
            </Link>
          </div>
        </div>
      </section>

      {/* Shop by Category */}
      <section className="py-16 bg-secondary/30">
        <div className="container">
          <h2 className="text-2xl lg:text-3xl font-serif font-bold text-center mb-10">
            Acheter par Catégorie
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              {
                name: 'Nettoyants',
                image:
                  'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&h=200&fit=crop',
              },
              {
                name: 'Toniques',
                image:
                  'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=200&h=200&fit=crop',
              },
              {
                name: 'Sérums',
                image:
                  'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=200&h=200&fit=crop',
              },
              {
                name: 'Crèmes',
                image:
                  'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=200&h=200&fit=crop',
              },
              {
                name: 'Masques',
                image:
                  'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=200&h=200&fit=crop',
              },
              {
                name: 'Solaires',
                image:
                  'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=200&h=200&fit=crop',
              },
            ].map((category) => (
              <Link
                key={category.name}
                href={`/products?category=${category.name.toLowerCase()}`}
                className="group text-center"
              >
                <div className="relative aspect-square rounded-full overflow-hidden mb-3 mx-auto w-24 lg:w-32 border-2 border-transparent group-hover:border-primary transition-colors">
                  <Image
                    src={category.image}
                    alt={category.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why K-Beauty */}
      <section className="py-16">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative aspect-[4/3] rounded-soft overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&h=600&fit=crop"
                alt="K-Beauty Routine"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-serif font-bold mb-6">Pourquoi K-Beauty?</h2>
              <p className="text-muted mb-6 leading-relaxed">
                La K-Beauty est reconnue mondialement pour ses formules innovantes et ses
                ingrédients de haute qualité. Découvrez une approche holistique des soins de la peau
                qui met l&apos;accent sur la prévention et l&apos;hydratation.
              </p>
              <ul className="space-y-4">
                {[
                  'Ingrédients innovants soutenus par la science',
                  'Routines multi-étapes pour des résultats maximaux',
                  'Formules douces pour tous les types de peau',
                  'Focus sur la prévention, pas seulement le traitement',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-medium">
                      {i + 1}
                    </span>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/routines" className="inline-block mt-8">
                <button className="btn-secondary">
                  Explorer les Routines
                  <ArrowRight className="ml-2 h-5 w-5" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Brands */}
      {brands.length > 0 && (
        <section className="py-16 bg-white dark:bg-card border-t border-gray-100 dark:border-border">
          <div className="container">
            <h2 className="text-2xl lg:text-3xl font-serif font-bold text-center mb-10">
              Nos Marques
            </h2>

            <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16">
              {brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/brands/${brand.slug}`}
                  className="text-xl lg:text-2xl font-serif font-medium text-muted hover:text-primary transition-colors"
                >
                  {brand.title}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
