import { sorting, type SortFilterItem } from '@/lib/constants'

/**
 * French labels for the sort options declared in `@/lib/constants`.
 * Kept here (instead of editing the shared constants file) so the storefront
 * never renders the template's English copy.
 */
const SORT_TITLES: Record<string, string> = {
  '-createdAt': 'Nouveautés',
  priceInUSD: 'Prix croissant',
  '-priceInUSD': 'Prix décroissant',
}

const DEFAULT_SORT_TITLE = 'Alphabétique (A-Z)'

export const sortingFr: SortFilterItem[] = sorting.map((item) => ({
  ...item,
  title: item.slug ? (SORT_TITLES[item.slug] ?? item.title) : DEFAULT_SORT_TITLE,
}))

export { DEFAULT_SORT_TITLE }
