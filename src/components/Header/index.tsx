import { getCachedGlobal } from '@/utilities/getGlobals'
import { getCachedCategoryNav } from '@/utilities/storefront'

import './index.css'
import { HeaderClient } from './index.client'

export async function Header() {
  const [header, categories] = await Promise.all([
    getCachedGlobal('header', 1)(),
    getCachedCategoryNav().catch(() => []),
  ])

  return <HeaderClient header={header} categories={categories} />
}
