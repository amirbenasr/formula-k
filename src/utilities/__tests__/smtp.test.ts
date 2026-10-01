import { describe, expect, it } from 'vitest'

import { getSmtpConfig, SMTP_SETUP_HINT } from '../smtp'

const resendEnv = {
  SMTP_HOST: 'smtp.resend.com',
  SMTP_PORT: '465',
  SMTP_USER: 'resend',
  SMTP_PASS: 're_test_key',
}

describe('getSmtpConfig', () => {
  it('reports unconfigured and omits empty values when SMTP is unset', () => {
    const smtp = getSmtpConfig({ SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '' })

    expect(smtp.configured).toBe(false)
    // The regression: Number('') === 0 and host: '' made nodemailer dial
    // localhost:465, producing "Error verifying Nodemailer transport".
    expect(smtp.transportOptions.host).toBeUndefined()
    expect(smtp.transportOptions.port).toBeUndefined()
    expect(smtp.transportOptions.auth).toBeUndefined()
  })

  it('reports unconfigured when no environment is supplied at all', () => {
    expect(getSmtpConfig({}).configured).toBe(false)
  })

  it('parses a complete Resend configuration on port 465 as implicit TLS', () => {
    const smtp = getSmtpConfig(resendEnv)

    expect(smtp.configured).toBe(true)
    expect(smtp.transportOptions).toMatchObject({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: 're_test_key' },
    })
  })

  it('uses STARTTLS on port 587', () => {
    const smtp = getSmtpConfig({ ...resendEnv, SMTP_PORT: '587' })

    expect(smtp.transportOptions.port).toBe(587)
    expect(smtp.secure).toBe(false)
  })

  it('lets SMTP_SECURE override the port-derived value', () => {
    expect(getSmtpConfig({ ...resendEnv, SMTP_SECURE: 'false' }).secure).toBe(false)
    expect(getSmtpConfig({ ...resendEnv, SMTP_PORT: '587', SMTP_SECURE: 'true' }).secure).toBe(true)
  })

  it('trims quoted or padded values pasted into .env', () => {
    const smtp = getSmtpConfig({ ...resendEnv, SMTP_HOST: ' smtp.resend.com ', SMTP_PORT: ' 465 ' })

    expect(smtp.transportOptions.host).toBe('smtp.resend.com')
    expect(smtp.transportOptions.port).toBe(465)
  })

  it('falls back to the project defaults for the from address and name', () => {
    const smtp = getSmtpConfig(resendEnv)

    expect(smtp.defaultFromAddress).toBe('cs@formula-k.tn')
    expect(smtp.defaultFromName).toBe('Formula K')
  })

  it('treats a missing password as unconfigured so it cannot mask a broken mailbox', () => {
    const smtp = getSmtpConfig({ ...resendEnv, SMTP_PASS: '' })

    expect(smtp.configured).toBe(false)
    expect(smtp.transportOptions.auth).toBeUndefined()
  })

  it('ignores a non-numeric port instead of sending NaN to nodemailer', () => {
    const smtp = getSmtpConfig({ ...resendEnv, SMTP_PORT: 'not-a-port' })

    expect(smtp.transportOptions.port).toBeUndefined()
    expect(smtp.configured).toBe(true)
  })

  it('exposes a setup hint that names the variables and the check command', () => {
    expect(SMTP_SETUP_HINT).toContain('SMTP_HOST')
    expect(SMTP_SETUP_HINT).toContain('pnpm smtp:check')
  })
})
