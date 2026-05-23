import { describe, expect, it } from 'vitest'
import { formatLocal, formatNum, toNumber } from './format'

describe('format', () => {
  it('formatNum should handle non-number input', () => {
    expect(formatNum(undefined)).toBe('0.00')
    expect(formatNum('abc', 3)).toBe('0.000')
  })

  it('formatNum should format numbers', () => {
    expect(formatNum(1)).toBe('1.00')
    expect(formatNum('1.2', 1)).toBe('1.2')
  })

  it('formatLocal should handle non-number input', () => {
    expect(formatLocal(undefined)).toBe('0')
    expect(formatLocal('abc')).toBe('0')
  })

  it('toNumber should fall back to default', () => {
    expect(toNumber(undefined)).toBe(0)
    expect(toNumber('abc', 7)).toBe(7)
    expect(toNumber('8')).toBe(8)
  })
})

