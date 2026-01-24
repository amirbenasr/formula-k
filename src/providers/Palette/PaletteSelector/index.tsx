'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import React from 'react'

import type { Palette } from '../types'
import { usePalette } from '..'

export const PaletteSelector: React.FC = () => {
  const { setPalette, palette } = usePalette()

  const onPaletteChange = (paletteToSet: Palette) => {
    setPalette(paletteToSet)
  }

  return (
    <Select onValueChange={onPaletteChange} value={palette}>
      <SelectTrigger className="w-auto bg-transparent gap-2 md:pl-3 border-none">
        <SelectValue placeholder="Palette" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="warm">Warm (Rose)</SelectItem>
        <SelectItem value="cool">Cool (Blue)</SelectItem>
      </SelectContent>
    </Select>
  )
}
