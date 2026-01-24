import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Settings',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'colorPalette',
      type: 'select',
      label: 'Color Palette',
      defaultValue: 'warm',
      options: [
        {
          label: 'Warm (Rose/Peach)',
          value: 'warm',
        },
        {
          label: 'Cool (Blue/Lavender)',
          value: 'cool',
        },
      ],
      admin: {
        description: 'Choose the color theme for the storefront. Warm uses rose/peach tones, Cool uses blue/lavender tones.',
      },
    },
    {
      name: 'siteName',
      type: 'text',
      label: 'Site Name',
      defaultValue: 'SouGlowy',
    },
    {
      name: 'siteDescription',
      type: 'textarea',
      label: 'Site Description',
      admin: {
        description: 'Used for SEO meta description',
      },
    },
  ],
}
