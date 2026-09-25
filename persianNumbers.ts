/**
 * Convert any string or number containing English digits (0-9) to Persian digits (۰-۹)
 */
export function toPersianDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return ''
  const str = String(input)
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return str.replace(/\d/g, (x) => persianDigits[parseInt(x, 10)])
}

/**
 * Convert any string containing Persian (۰-۹) or Arabic (٠-٩) digits to English digits (0-9)
 */
export function toEnglishDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return ''
  const str = String(input)
  return str
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
}


/**
 * Format a number to standard Persian score out of 20
 * e.g. (15, 20) -> "۱۵ از ۲۰" or "۱۵ / ۲۰"
 */
export function formatScoreTo20(score: number | string | undefined | null, maxScore?: number | string): string {
  if (score === undefined || score === null || score === '') return 'ثبت نشده'
  const num = Number(score)
  if (isNaN(num)) return String(score)

  const max = Number(maxScore) || 20
  // Scale to 20
  const normalized = max > 0 ? (num / max) * 20 : num
  const rounded = Number(normalized.toFixed(normalized % 1 === 0 ? 0 : 1))
  return `${toPersianDigits(rounded)} از ۲۰`
}

/**
 * Clean up exam or question title to avoid showing raw AI prompts
 */
export function cleanTitle(title: string | undefined | null, fallbackSubject = 'درس'): string {
  if (!title) return fallbackSubject
  let cleaned = String(title).trim()

  // Remove common AI prompt patterns
  cleaned = cleaned.replace(/^(یک\s*آزمون\s*(بساز|طراحی\s*کن|بگیر)|طراحی\s*آزمون|آزمون\s*از\s*مبحث|آزمونک\s*از|سوالات\s*مبحث)/gi, '')
  cleaned = cleaned.replace(/^(لطفاً|لطفا|می‌خوام|میخوام)\s*/gi, '')
  cleaned = cleaned.replace(/^[:،\-\s]+/, '')
  cleaned = cleaned.replace(/[:،\-\s]+$/, '')

  if (!cleaned || cleaned.length < 2) {
    return fallbackSubject || 'آزمون کلاسی'
  }

  // Prepend clean indicator if needed
  if (!cleaned.includes('آزمون') && !cleaned.includes('تکلیف') && !cleaned.includes('تمرین')) {
    return `آزمونک: ${cleaned}`
  }

  return cleaned
}
