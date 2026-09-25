/**
 * Persian Name Sorting & Formatting Utilities
 * Sorts students primarily by family name (نام خانوادگی), then first name (نام).
 */

export function extractLastName(fullName: string | null | undefined): string {
  if (!fullName) return ''
  const trimmed = fullName.trim()

  // Remove bracketed or parenthesized distinctions like "(بهنام)" or "(میرزا)" for clean sorting
  const cleanName = trimmed.replace(/\s*\([^)]*\)\s*/g, ' ').trim()

  const parts = cleanName.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] || ''

  // Everything after the first word is considered part of the last name (e.g. "محمد احمدی" -> "احمدی", "سید علی حسینی" -> "حسینی")
  // For names like "سید علی حسینی", parts are ["سید", "علی", "حسینی"].
  if (parts[0] === 'سید' || parts[0] === 'سیده' || parts[0] === 'میر') {
    if (parts.length >= 3) {
      return parts.slice(2).join(' ')
    }
  }
  return parts.slice(1).join(' ')
}

export function extractFirstName(fullName: string | null | undefined): string {
  if (!fullName) return ''
  const trimmed = fullName.trim().replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] || ''
  if ((parts[0] === 'سید' || parts[0] === 'سیده' || parts[0] === 'میر') && parts.length >= 3) {
    return `${parts[0]} ${parts[1]}`
  }
  return parts[0]
}

/**
 * Sorts an array of objects having a `full_name` or `name` property by last name (فامیل)
 */
export function sortByLastName<T extends Record<string, any>>(
  list: T[],
  nameKey: keyof T = 'full_name' as keyof T
): T[] {
  return [...list].sort((a, b) => {
    const nameA = String(a[nameKey] || '')
    const nameB = String(b[nameKey] || '')

    const lastNameA = extractLastName(nameA)
    const lastNameB = extractLastName(nameB)

    const cmp = lastNameA.localeCompare(lastNameB, 'fa')
    if (cmp !== 0) return cmp

    const firstNameA = extractFirstName(nameA)
    const firstNameB = extractFirstName(nameB)
    return firstNameA.localeCompare(firstNameB, 'fa')
  })
}
