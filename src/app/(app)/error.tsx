'use client'

import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container">
      <div className="surface surface-pad mx-auto my-10 flex max-w-xl flex-col items-start gap-4 sm:my-16 sm:p-8">
        <h1 className="font-serif text-2xl font-medium text-foreground sm:text-3xl">
          Une erreur est survenue
        </h1>
        <p className="text-sm text-muted">
          La boutique a rencontré un problème temporaire. Vous pouvez réessayer ; si cela persiste,
          revenez dans quelques instants.
        </p>
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <Button className="w-full sm:w-auto" onClick={() => reset()} type="button">
            <RotateCcw className="h-4 w-4" />
            Réessayer
          </Button>
          <Button asChild className="w-full sm:w-auto" variant="outline">
            <Link href="/">Retour à l’accueil</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
