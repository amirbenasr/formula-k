import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { adminOrSelf } from '@/access/adminOrSelf'
import { publicAccess } from '@/access/publicAccess'
import { checkRole } from '@/access/utilities'

import { ensureFirstUserIsAdmin } from './hooks/ensureFirstUserIsAdmin'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: ({ req: { user } }) => checkRole(['admin'], user),
    create: publicAccess,
    delete: adminOnly,
    read: adminOrSelf,
    update: adminOrSelf,
  },
  admin: {
    group: 'Users',
    defaultColumns: ['name', 'email', 'roles'],
    useAsTitle: 'name',
  },
  auth: {
    tokenExpiration: 1209600,
    verify: {
      generateEmailHTML: ({ token, user }: { token: string; user: { email: string } }) => {
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://formula-k.tn'
        const verifyURL = `${baseUrl}/verify-email?token=${token}`

        return `
          <!doctype html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Verify Your Email</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <tr>
                  <td style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #18181b;">Welcome to Formula K!</h1>
                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #3f3f46;">Hello,</p>
                    <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #3f3f46;">Thank you for creating an account with us. Please verify your email address <strong>${user.email}</strong> to complete your registration.</p>
                    <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #3f3f46;">Click the button below to verify your email:</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 24px;">
                      <tr>
                        <td style="background-color: #18181b; border-radius: 6px;">
                          <a href="${verifyURL}" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: 500; color: #ffffff; text-decoration: none;">Verify Email</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0 0 16px; font-size: 14px; line-height: 20px; color: #71717a;">If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="margin: 0 0 24px; font-size: 14px; line-height: 20px; color: #3b82f6; word-break: break-all;"><a href="${verifyURL}" style="color: #3b82f6;">${verifyURL}</a></p>
                    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
                    <p style="margin: 0; font-size: 14px; line-height: 20px; color: #a1a1aa;">If you didn't create an account with Formula K, you can safely ignore this email.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #71717a;">&copy; ${new Date().getFullYear()} Formula K. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `
      },
    },
    forgotPassword: {
      generateEmailHTML: ({ token, user } = {}) => {
        if (!token || !user?.email) return ''
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://formula-k.tn'
        const resetPasswordURL = `${baseUrl}/reset-password?token=${token}`

        return `
          <!doctype html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Reset Your Password</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <tr>
                  <td style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #18181b;">Reset Your Password</h1>
                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #3f3f46;">Hello,</p>
                    <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #3f3f46;">We received a request to reset the password for your account associated with <strong>${user.email}</strong>.</p>
                    <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #3f3f46;">Click the button below to reset your password:</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 24px;">
                      <tr>
                        <td style="background-color: #18181b; border-radius: 6px;">
                          <a href="${resetPasswordURL}" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: 500; color: #ffffff; text-decoration: none;">Reset Password</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0 0 16px; font-size: 14px; line-height: 20px; color: #71717a;">If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="margin: 0 0 24px; font-size: 14px; line-height: 20px; color: #3b82f6; word-break: break-all;"><a href="${resetPasswordURL}" style="color: #3b82f6;">${resetPasswordURL}</a></p>
                    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
                    <p style="margin: 0; font-size: 14px; line-height: 20px; color: #a1a1aa;">If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #71717a;">&copy; ${new Date().getFullYear()} Formula K. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `
      },
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      access: {
        create: adminOnlyFieldAccess,
        read: adminOnlyFieldAccess,
        update: adminOnlyFieldAccess,
      },
      defaultValue: ['customer'],
      hasMany: true,
      hooks: {
        beforeChange: [ensureFirstUserIsAdmin],
      },
      options: [
        {
          label: 'admin',
          value: 'admin',
        },
        {
          label: 'customer',
          value: 'customer',
        },
      ],
    },
    {
      name: 'orders',
      type: 'join',
      collection: 'orders',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'createdAt', 'total', 'currency', 'items'],
      },
    },
    {
      name: 'cart',
      type: 'join',
      collection: 'carts',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'createdAt', 'total', 'currency', 'items'],
      },
    },
    {
      name: 'addresses',
      type: 'join',
      collection: 'addresses',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id'],
      },
    },
  ],
}
