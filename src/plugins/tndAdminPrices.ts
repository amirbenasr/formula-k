import type { CollectionConfig, Config, Field, Plugin } from 'payload'

/**
 * The ecommerce plugin builds its money fields from a supported-currency list that
 * defaults to `[{ code: 'USD', decimals: 2, symbol: '$' }]`.
 *
 * Formula K stores amounts as plain Tunisian dinars rather than as USD cents, so
 * those fields were wrong twice over: a 189 DT product showed up as "$1.89", and
 * typing "189" into the input stored 18900, which the storefront then printed as
 * "18 900 DT".
 *
 * Configuring the plugin with a TND currency would rename the column to
 * `priceInTND` and require migrating the price columns *and* the currency enums on
 * carts, orders and transactions, plus every `priceInUSD` reference in the app.
 * Until that refactor happens, this plugin fixes the admin presentation only: the
 * same stored number, labelled and formatted as dinars.
 *
 * Every money field the plugin creates is built by its `amountField` helper, so
 * they are identified by the components it puts on them rather than by name —
 * which covers products, variants, carts, orders and transactions in one pass.
 */
const PLUGIN_PRICE_INPUT = '@payloadcms/plugin-ecommerce/rsc#PriceInput'
const PLUGIN_PRICE_CELL = '@payloadcms/plugin-ecommerce/client#PriceCell'

const TND_PRICE_INPUT = '@/components/admin/TNDPriceInput#TNDPriceInput'
const TND_PRICE_CELL = '@/components/admin/TNDPriceCell#TNDPriceCell'

const CURRENCY_CODE = 'TND'
const CURRENCY_NAME = 'Tunisian Dinar'
const CURRENCY_SYMBOL = 'DT'

const PRICE_DESCRIPTION = `The price customers pay, in Tunisian dinars (${CURRENCY_SYMBOL}). Also used for sorting and filtering products; with variants enabled, enter the lowest or average price, as the variant price is used at checkout.`

const PRICE_GROUP_DESCRIPTION = `Prices are in Tunisian dinars (${CURRENCY_SYMBOL}), never in cents — the number entered here is exactly what the storefront charges.`

/**
 * A structural view of a field. Payload's `Field` is a large union; the plugin
 * only needs to walk it and swap a couple of admin properties, so the traversal
 * is typed loosely and cast back at the boundary.
 */
type LooseField = {
  admin?: {
    components?: Record<string, unknown>
    description?: unknown
  }
  blocks?: LooseField[]
  fields?: LooseField[]
  label?: unknown
  name?: string
  options?: unknown[]
  tabs?: { fields?: LooseField[] }[]
  type?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Component entries are either a path string or `{ path, clientProps }`. */
const componentPath = (component: unknown): string | undefined => {
  if (typeof component === 'string') return component
  if (isRecord(component) && typeof component.path === 'string') return component.path

  return undefined
}

/** True for the price/amount fields the ecommerce plugin created. */
const isMoneyField = (field: LooseField): boolean =>
  componentPath(field.admin?.components?.Field) === PLUGIN_PRICE_INPUT

/** `priceInUSD` → `USD`, `priceInUSDEnabled` → `USD`, anything else → null. */
const currencyOf = (name: string | undefined): string | null => {
  const match = /^priceIn([A-Z]{3})(?:Enabled)?$/.exec(name ?? '')

  return match?.[1] ?? null
}

const isCurrencyToggle = (name: string | undefined): boolean =>
  /^priceIn[A-Z]{3}Enabled$/.test(name ?? '')

/**
 * The plugin's `currency` select (read-only, since only one currency is
 * configured) offers "US Dollar (USD)". Its *value* has to stay `USD` — the
 * plugin looks prices up as `priceIn${currency}` and the Postgres enum only
 * accepts `USD` — but the label is what the admin shows, so it gets truthed up.
 */
const patchCurrencyField = (field: LooseField): LooseField => {
  if (field.type !== 'select' || field.name !== 'currency' || !Array.isArray(field.options)) {
    return field
  }

  return {
    ...field,
    options: field.options.map((option) =>
      isRecord(option)
        ? { ...option, label: `${CURRENCY_NAME} (${CURRENCY_SYMBOL})` }
        : option,
    ),
  }
}

const patchMoneyField = (field: LooseField): LooseField => {
  const components: Record<string, unknown> = {
    ...field.admin?.components,
    Field: TND_PRICE_INPUT,
  }

  if (componentPath(field.admin?.components?.Cell) === PLUGIN_PRICE_CELL) {
    components.Cell = TND_PRICE_CELL
  }

  const admin = { ...field.admin, components }
  const patched: LooseField = { ...field, admin }

  // Orders (`amount`), carts (`subtotal`) and transactions keep their own labels —
  // only the product/variant currency fields are named after a currency.
  if (currencyOf(field.name)) {
    patched.label = `Price (${CURRENCY_CODE})`
    admin.description = PRICE_DESCRIPTION
  }

  return patched
}

const containsMoneyField = (field: LooseField): boolean =>
  isMoneyField(field) ||
  [
    ...(field.fields ?? []),
    ...(field.tabs ?? []).flatMap((tab) => tab.fields ?? []),
    ...(field.blocks ?? []).flatMap((block) => block.fields ?? []),
  ].some(containsMoneyField)

const patchField = (field: LooseField): LooseField => {
  if (isMoneyField(field)) return patchMoneyField(field)

  // The plugin pairs each price with an "Enable <currency> price" checkbox.
  if (isCurrencyToggle(field.name)) {
    return { ...field, label: `Enable ${CURRENCY_CODE} price` }
  }

  const patched: LooseField = { ...patchCurrencyField(field) }

  if (Array.isArray(field.fields)) {
    patched.fields = field.fields.map(patchField)
  }

  if (Array.isArray(field.tabs)) {
    patched.tabs = field.tabs.map((tab) =>
      Array.isArray(tab.fields) ? { ...tab, fields: tab.fields.map(patchField) } : tab,
    )
  }

  if (Array.isArray(field.blocks)) {
    patched.blocks = field.blocks.map((block) =>
      Array.isArray(block.fields) ? { ...block, fields: block.fields.map(patchField) } : block,
    )
  }

  if (field.type === 'group' && !field.name && containsMoneyField(field)) {
    patched.admin = { ...field.admin, description: PRICE_GROUP_DESCRIPTION }
  }

  return patched
}

export const patchMoneyFields = (fields: Field[]): Field[] =>
  (fields as unknown as LooseField[]).map(patchField) as unknown as Field[]

export const patchCollectionMoneyFields = (collection: CollectionConfig): CollectionConfig => ({
  ...collection,
  fields: patchMoneyFields(collection.fields),
})

/**
 * Registered last in `src/plugins/index.ts`, after `ecommercePlugin`, so the money
 * fields it creates are already in the config.
 */
export const tndAdminPricesPlugin: Plugin = (config: Config): Config => ({
  ...config,
  collections: config.collections?.map(patchCollectionMoneyFields),
})
