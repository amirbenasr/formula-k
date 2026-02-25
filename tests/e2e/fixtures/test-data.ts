export const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// Admin credentials — uses an existing admin from the dev database.
// Override via env vars if needed: TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'amirbennasr@gmail.com'
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'ythgnb15'

// Test customer created by the setup
export const CUSTOMER_EMAIL = 'customer-e2e@gmail.com'
export const CUSTOMER_PASSWORD = 'CustomerPass123'

export const GUEST_EMAIL = 'guest-e2e@gmail.com'

export const TEST_ADDRESS = {
  firstName: 'Test',
  lastName: 'User',
  addressLine1: '123 Rue de la Beauté',
  city: 'Paris',
  postalCode: '75001',
  country: 'France',
}

export const AUTH_DIR = '.auth'
export const ADMIN_AUTH_FILE = `${AUTH_DIR}/admin.json`
export const CUSTOMER_AUTH_FILE = `${AUTH_DIR}/customer.json`
