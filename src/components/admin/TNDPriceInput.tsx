'use client'

import { FieldDescription, FieldError, FieldLabel, useField } from '@payloadcms/ui'
import type { NumberFieldClientComponent } from 'payload'
import type { ChangeEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'

import { parseAmount, roundAmount, toAmount, toDisplay } from './tndPrice'

/**
 * Number input for money in the admin panel.
 *
 * The ecommerce plugin's own `PriceInput` divides by 10^decimals and prefixes the
 * currency symbol, which is wrong for this project: amounts are stored as plain
 * dinars (see `./tndPrice`). This input reads and writes the stored number
 * unchanged, so what the shop owner types is what the storefront charges.
 *
 * Rendering lives inside `.field-type.number` so Payload's own input styles
 * (`@payloadcms/ui/dist/fields/Number/index.scss`) still apply.
 */
export const TNDPriceInput: NumberFieldClientComponent = ({ field, path, readOnly }) => {
  const { setValue, showError, value } = useField<unknown>({ path })
  const [draft, setDraft] = useState(() => toDisplay(value))

  /**
   * Follow the form value when it changes from the outside (document load, undo,
   * reset) without clobbering what is being typed: `"49,"` parses to the same 49
   * the form already holds, so the draft is left alone.
   */
  useEffect(() => {
    setDraft((current) => (parseAmount(current) === toAmount(value) ? current : toDisplay(value)))
  }, [value])

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value

      // Digits with at most one decimal separator, so a trailing "49," stays editable.
      if (!/^\d*(?:[.,]\d*)?$/.test(next)) return

      setDraft(next)
      setValue(parseAmount(next))
    },
    [setValue],
  )

  const handleBlur = useCallback(() => {
    const amount = parseAmount(draft)

    if (amount === null) {
      setValue(null)
      setDraft('')
      return
    }

    const rounded = roundAmount(amount)

    setValue(rounded)
    setDraft(toDisplay(rounded))
  }, [draft, setValue])

  const id = `field-${path.replace(/\./g, '__')}`

  return (
    <div
      className={['field-type', 'number', showError && 'error', readOnly && 'read-only']
        .filter(Boolean)
        .join(' ')}
    >
      <FieldLabel as="label" htmlFor={id} label={field.label} required={field.required} />
      <div className="field-type__wrap">
        <FieldError path={path} showError={showError} />
        <div style={{ alignItems: 'center', display: 'flex', gap: 'calc(var(--base) / 2)' }}>
          <input
            disabled={readOnly}
            id={id}
            inputMode="decimal"
            name={path}
            onBlur={handleBlur}
            onChange={handleChange}
            placeholder="0.00"
            type="text"
            value={draft}
          />
          <span aria-hidden style={{ color: 'var(--theme-elevation-500)', whiteSpace: 'nowrap' }}>
            DT
          </span>
        </div>
      </div>
      <FieldDescription description={field.admin?.description} path={path} />
    </div>
  )
}
