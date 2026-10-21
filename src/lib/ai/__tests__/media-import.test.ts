import { describe, expect, it } from 'vitest'

import { assertFetchableUrl, ImageImportError } from '../media-import'

/**
 * These guard server-side fetches of URLs a language model chose. Getting this
 * wrong turns the chat into an SSRF primitive against the host network, so the
 * cases below are the ones that actually matter.
 */
describe('assertFetchableUrl', () => {
  it('accepts a public https URL', () => {
    expect(assertFetchableUrl('https://live.staticflickr.com/1/2/3.jpg').hostname).toBe(
      'live.staticflickr.com',
    )
  })

  it('accepts a public http URL', () => {
    expect(assertFetchableUrl('http://example.com/a.jpg').protocol).toBe('http:')
  })

  it('accepts a public address just outside the private 172.16/12 range', () => {
    expect(assertFetchableUrl('http://172.32.0.1/a.jpg').hostname).toBe('172.32.0.1')
  })

  it('rejects non-HTTP schemes', () => {
    expect(() => assertFetchableUrl('file:///etc/passwd')).toThrow(ImageImportError)
    expect(() => assertFetchableUrl('javascript:alert(1)')).toThrow(/only http\(s\) is allowed/)
    expect(() => assertFetchableUrl('data:image/png;base64,AAAA')).toThrow(ImageImportError)
  })

  it('rejects a string that is not a URL', () => {
    expect(() => assertFetchableUrl('anua toner')).toThrow(/is not a valid URL/)
  })

  it.each([
    'http://localhost:3000/api/media',
    'http://127.0.0.1/a.jpg',
    'http://0.0.0.0/a.jpg',
    'http://10.1.2.3/a.jpg',
    'http://192.168.1.10/a.jpg',
    'http://172.16.0.1/a.jpg',
    'http://172.31.255.255/a.jpg',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/a.jpg',
    'http://metadata.google.internal/computeMetadata/v1/',
  ])('rejects the private or loopback target %s', (url) => {
    expect(() => assertFetchableUrl(url)).toThrow(/private and loopback addresses/)
  })
})
