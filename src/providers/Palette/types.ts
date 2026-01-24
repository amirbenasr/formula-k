export type Palette = 'warm' | 'cool'

export interface PaletteContextType {
  setPalette: (palette: Palette) => void
  palette: Palette
}

export function paletteIsValid(string: null | string): string is Palette {
  return string ? ['warm', 'cool'].includes(string) : false
}
