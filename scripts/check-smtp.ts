/**
 * Verifies the SMTP configuration by sending a real test email through the exact
 * adapter Payload uses.
 *
 *   pnpm smtp:check                          # send to SMTP_FROM_ADDRESS
 *   pnpm smtp:check -- --to you@example.com  # send somewhere specific
 *
 * Resend (current provider): SMTP_HOST=smtp.resend.com, SMTP_PORT=465,
 * SMTP_USER=resend, SMTP_PASS=<Resend API key, starts with re_>.
 */
import 'dotenv/config'

import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import type { Payload } from 'payload'

import { getSmtpConfig, SMTP_SETUP_HINT } from '../src/utilities/smtp'

const args = process.argv.slice(2)
const toFlag = args.indexOf('--to')
const to = (toFlag !== -1 ? args[toFlag + 1] : undefined) || process.env.SMTP_FROM_ADDRESS

const smtp = getSmtpConfig()

const mask = (value?: string) => (value ? `${value.slice(0, 3)}*** (${value.length} chars)` : '(unset)')

console.log('▶ SMTP configuration')
console.log('  host      :', smtp.transportOptions.host ?? '(unset)')
console.log('  port      :', smtp.transportOptions.port ?? '(unset — provider default)')
console.log('  secure    :', smtp.secure, smtp.secure ? '(implicit TLS)' : '(STARTTLS)')
console.log('  user      :', smtp.transportOptions.auth?.user ?? '(unset)')
console.log('  password  :', mask(smtp.transportOptions.auth?.pass))
console.log('  from      :', `${smtp.defaultFromName} <${smtp.defaultFromAddress}>`)

if (!smtp.configured) {
  console.error(`\n✖ SMTP is not configured. ${SMTP_SETUP_HINT}`)
  process.exit(1)
}

const adapter = await nodemailerAdapter({
  defaultFromAddress: smtp.defaultFromAddress,
  defaultFromName: smtp.defaultFromName,
  // The send below is the real check — verifying first would only log the same
  // failure twice.
  skipVerify: true,
  transportOptions: smtp.transportOptions,
})

const { sendEmail } = adapter({ payload: undefined as unknown as Payload })

console.log(`\n▶ Sending test email to ${to}`)

try {
  const info = await sendEmail({
    to: to as string,
    subject: 'Formula K — SMTP test',
    html: '<p>SMTP is configured correctly. Password reset and verification emails will be delivered.</p>',
  })

  console.log('\n✔ SMTP works — message accepted by the server.')
  console.log('  messageId:', (info as { messageId?: string })?.messageId ?? '(none)')
} catch (error) {
  const err = error as { code?: string; command?: string; message?: string; response?: string }
  console.error('\n✖ SMTP failed')
  console.error('  code   :', err.code ?? '(none)')
  console.error('  command:', err.command ?? '(none)')
  console.error('  response:', err.response ?? '(none)')
  console.error('  message:', err.message ?? err)

  const hints: Record<string, string> = {
    EAUTH: 'Resend rejects the password unless it is a full API key (re_...), not a restricted/sending key. Check SMTP_USER=resend and SMTP_PASS.',
    ECONNECTION: 'Cannot reach the host. Check SMTP_HOST/SMTP_PORT and that outbound port 465 is allowed on this network.',
    ECONNREFUSED: 'Nothing is listening on that host:port — the port is usually wrong (465 = implicit TLS, 587 = STARTTLS).',
    ESOCKET: 'TLS/connection problem. Try the other port, or set SMTP_SECURE=true/false explicitly to match it.',
    ETIMEDOUT: 'Connection timed out — likely a firewall blocking the port, or the wrong host.',
  }

  if (err.code && hints[err.code]) console.error('\n  hint:', hints[err.code])
  console.error(`\n  ${SMTP_SETUP_HINT}`)
  process.exit(1)
}

process.exit(0)
