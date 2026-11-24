const digitsCache = new Map<string, number>()

export function getCurrencyDigits(currency: string): number {
  const code = (currency || 'USD').toUpperCase()
  const cached = digitsCache.get(code)
  if (cached !== undefined) return cached
  try {
    const digits = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
    }).resolvedOptions().maximumFractionDigits ?? 2
    digitsCache.set(code, digits)
    return digits
  } catch {
    return 2
  }
}

export function formatMoney(minorUnits: number, currency: string): string {
  const code = (currency || 'USD').toUpperCase()
  const digits = getCurrencyDigits(code)
  const factor = 10 ** digits
  const value = minorUnits / factor
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value)
  } catch {
    return `${code} ${value.toFixed(digits)}`
  }
}

/** Parse user-typed decimal text into exact integer minor units without float drift. */
export function parseMajorToMinor(raw: string, currency: string): number {
  const cleaned = raw.trim().replace(/,/g, '')
  if (!cleaned) return 0
  const negative = cleaned.startsWith('-')
  const unsigned = negative ? cleaned.slice(1) : cleaned
  if (!/^\d*(\.\d*)?$/.test(unsigned)) return 0
  const digits = getCurrencyDigits(currency)
  const [wholePart = '0', fracPart = ''] = unsigned.split('.')
  const whole = Number.parseInt(wholePart || '0', 10)
  if (!Number.isFinite(whole)) return 0
  if (digits === 0) {
    const roundUp = fracPart.length > 0 && Number.parseInt(fracPart[0] ?? '0', 10) >= 5
    const total = whole + (roundUp ? 1 : 0)
    return negative ? -total : total
  }
  const paddedFrac = (fracPart + '0'.repeat(digits + 1)).slice(0, digits)
  const nextDigit = Number.parseInt((fracPart + '0'.repeat(digits + 1))[digits] ?? '0', 10)
  const frac = Number.parseInt(paddedFrac || '0', 10)
  const factor = 10 ** digits
  const total = whole * factor + frac + (nextDigit >= 5 ? 1 : 0)
  return negative ? -total : total
}

export function minorToEditableString(minorUnits: number, currency: string): string {
  const digits = getCurrencyDigits(currency)
  if (digits === 0) return String(Math.round(minorUnits))
  const factor = 10 ** digits
  const sign = minorUnits < 0 ? '-' : ''
  const abs = Math.abs(Math.round(minorUnits))
  const whole = Math.floor(abs / factor)
  const frac = String(abs % factor).padStart(digits, '0')
  return `${sign}${whole}.${frac}`
}

/** Exact half-up integer proration: ratePerHourMinor * durationMinutes / 60. */
export function prorateHourlyMinor(ratePerHourMinor: number, durationMinutes: number): number {
  if (ratePerHourMinor <= 0 || durationMinutes <= 0) return 0
  return Math.floor((ratePerHourMinor * durationMinutes + 30) / 60)
}
