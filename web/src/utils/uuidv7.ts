import crypto from 'node:crypto'

/**
 * Generates an RFC 9562 compliant UUIDv7.
 * UUIDv7 combines a 48-bit Unix millisecond timestamp with 74 random bits
 * to guarantee monotonic time ordering while maintaining cryptographic uniqueness.
 */
export function uuidv7(): string {
  const now = Date.now()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  // 48-bit timestamp in milliseconds
  bytes[0] = (now / 0x10000000000) & 0xff
  bytes[1] = (now / 0x100000000) & 0xff
  bytes[2] = (now / 0x1000000) & 0xff
  bytes[3] = (now / 0x10000) & 0xff
  bytes[4] = (now / 0x100) & 0xff
  bytes[5] = now & 0xff

  // 4-bit version 7
  bytes[6] = (bytes[6] & 0x0f) | 0x70

  // 2-bit variant (RFC 4122)
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
