'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

import type { Palette, PaletteContextType } from './types'
import { paletteIsValid } from './types'

const initialContext: PaletteContextType = {
  setPalette: () => null,
  palette: 'warm',
}

const PaletteContext = createContext(initialContext)

export const PaletteProvider = ({
  children,
  initialPalette = 'warm',
}: {
  children: React.ReactNode
  initialPalette?: Palette
}) => {
  const [palette, setPaletteState] = useState<Palette>(initialPalette)

  const setPalette = useCallback((paletteToSet: Palette) => {
    if (paletteIsValid(paletteToSet)) {
      setPaletteState(paletteToSet)
      document.documentElement.setAttribute('data-palette', paletteToSet)
    }
  }, [])

  useEffect(() => {
    // Set the initial palette from server
    document.documentElement.setAttribute('data-palette', initialPalette)
    setPaletteState(initialPalette)
  }, [initialPalette])

  return (
    <PaletteContext.Provider value={{ setPalette, palette }}>
      {children}
    </PaletteContext.Provider>
  )
}

export const usePalette = (): PaletteContextType => useContext(PaletteContext)
