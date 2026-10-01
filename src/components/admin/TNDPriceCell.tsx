'use client'

import type { DefaultCellComponentProps } from 'payload'

import { formatPrice } from '@/lib/utils'

/**
 * List-view cell for money. Uses the same formatter as the storefront, so the
 * admin and the shop always print the same figure (e.g. `189 DT`).
 */
export const TNDPriceCell = ({ cellData, rowData }: DefaultCellComponentProps) => {
  if (typeof cellData !== 'number') {
    return <span>{rowData?.enableVariants ? 'Set in variants' : '—'}</span>
  }

  return <span>{formatPrice(cellData)}</span>
}
