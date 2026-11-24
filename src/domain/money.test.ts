import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  getCurrencyDigits,
  minorToEditableString,
  parseMajorToMinor,
  prorateHourlyMinor,
} from './money'

describe('money precision', () => {
  it('detects currency decimal places via Intl', () => {
    expect(getCurrencyDigits('USD')).toBe(2)
    expect(getCurrencyDigits('EUR')).toBe(2)
    expect(getCurrencyDigits('IQD')).toBe(0)
    expect(getCurrencyDigits('JPY')).toBe(0)
  })

  it('parses decimal major amounts without float drift', () => {
    expect(parseMajorToMinor('19.99', 'USD')).toBe(1999)
    expect(parseMajorToMinor('0.1', 'USD')).toBe(10)
    expect(parseMajorToMinor('1,250.55', 'EUR')).toBe(125055)
    expect(parseMajorToMinor('25000', 'IQD')).toBe(25000)
    expect(parseMajorToMinor('25000.6', 'IQD')).toBe(25001)
    expect(minorToEditableString(1999, 'USD')).toBe('19.99')
    expect(minorToEditableString(25000, 'IQD')).toBe('25000')
  })

  it('prorates odd hourly durations cleanly in integer minor units', () => {
    expect(prorateHourlyMinor(6000, 45)).toBe(4500) // $60/hr * 45m = $45.00
    expect(prorateHourlyMinor(6000, 75)).toBe(7500) // $60/hr * 75m = $75.00
    expect(prorateHourlyMinor(6000, 90)).toBe(9000) // $60/hr * 90m = $90.00
    expect(prorateHourlyMinor(5500, 45)).toBe(4125) // $55/hr * 45m = $41.25
    expect(prorateHourlyMinor(5000, 50)).toBe(4167) // $50/hr * 50m = $41.67 half-up
    expect(prorateHourlyMinor(7500, 0)).toBe(0)
  })

  it('formats money cleanly', () => {
    expect(formatMoney(7500, 'USD')).toBe('$75.00')
    expect(formatMoney(25000, 'IQD')).toContain('25,000')
  })
})
