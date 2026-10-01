import type { NodemailerAdapterArgs } from '@payloadcms/email-nodemailer'

/**
 * Actionable hint shown whenever SMTP is missing or broken. Referenced by the
 * Payload config warning and by `scripts/check-smtp.ts`, so keep it in one place.
 */
export const SMTP_SETUP_HINT =
  'Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in .env (see .env.example), then run `pnpm smtp:check` to verify.'

export type SmtpConfig = {
  /** All of host/user/pass present — i.e. there is something real to connect to. */
  configured: boolean
  defaultFromAddress: string
  defaultFromName: string
  /** Implicit TLS (true) vs STARTTLS upgrade (false). */
  secure: boolean
  transportOptions: NonNullable<NodemailerAdapterArgs['transportOptions']>
}

/**
 * Builds Nodemailer transport options from the SMTP_* environment variables.
 *
 * Two things this deliberately does differently from the naive config:
 *
 * 1. Unset variables are omitted instead of passed as `''`/`0`. `Number('')` is
 *    `0` and an empty host makes nodemailer dial localhost, which is what made
 *    every boot log `Error verifying Nodemailer transport` with an
 *    `ECONNREFUSED ::1:465` and no mention of the real problem.
 * 2. `secure` is derived from the port (465 = implicit TLS, everything else =
 *    STARTTLS) instead of being hard-coded, because hard-coding `secure: true`
 *    breaks providers that expect STARTTLS on 587. `SMTP_SECURE` still wins.
 */
export function getSmtpConfig(env: Record<string, string | undefined> = process.env): SmtpConfig {
  const host = env.SMTP_HOST?.trim()
  const rawPort = env.SMTP_PORT?.trim()
  const port = rawPort ? Number(rawPort) : undefined
  const user = env.SMTP_USER?.trim()
  const pass = env.SMTP_PASS

  const hasPort = typeof port === 'number' && Number.isFinite(port) && port > 0
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE.trim() === 'true' : hasPort ? port === 465 : true

  const authenticated = Boolean(user && pass)

  return {
    configured: Boolean(host && authenticated),
    defaultFromAddress: env.SMTP_FROM_ADDRESS || 'cs@formula-k.tn',
    defaultFromName: env.SMTP_FROM_NAME || 'Formula K',
    secure,
    transportOptions: {
      ...(host ? { host } : {}),
      ...(hasPort ? { port } : {}),
      secure,
      ...(authenticated ? { auth: { user: user as string, pass: pass as string } } : {}),
    },
  }
}
