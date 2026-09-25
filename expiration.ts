import { toEnglishDigits } from './persianNumbers'

/**
 * Robust date parser supporting Persian digits, slashes, and ISO timestamps
 */
function parseDateToMs(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const cleaned = toEnglishDigits(String(dateStr)).trim()
  if (!cleaned) return null

  // 1. Direct standard date parse
  const directMs = new Date(cleaned).getTime()
  if (!isNaN(directMs)) return directMs

  // 2. Replace spaces with T and slashes with dashes (e.g. "2026/09/24 10:00" -> "2026-09-24T10:00")
  const formatted = cleaned.replace(/\//g, '-').replace(' ', 'T')
  const formattedMs = new Date(formatted).getTime()
  if (!isNaN(formattedMs)) return formattedMs

  return null
}

/**
 * Expiration helper for student announcements, homework, and exams.
 * Items older than `daysThreshold` (e.g. 3 days for exams, 5 days for posts) past their deadline
 * or scheduled conclusion time are marked expired for the student view.
 */
export function isItemExpiredForStudent(
  item: {
    created_at?: string
    createdAt?: string
    publish_at?: string
    due_at?: string
    dueDate?: string
    scheduledStartTime?: string
    scheduledEndTime?: string
    durationMinutes?: number
  },
  daysThreshold = 5
): boolean {
  if (!item) return false
  const now = Date.now()
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000

  // 1. Due date (dueDate or due_at) - for assignments and homework
  const dueMs = parseDateToMs(item.dueDate || item.due_at)
  if (dueMs !== null) {
    return now > dueMs + thresholdMs
  }

  // 2. Online Exams: scheduledEndTime or (scheduledStartTime + durationMinutes)
  const endMs = parseDateToMs(item.scheduledEndTime)
  if (endMs !== null) {
    return now > endMs + thresholdMs
  }

  const startMs = parseDateToMs(item.scheduledStartTime)
  if (startMs !== null) {
    const durMs = (item.durationMinutes && item.durationMinutes > 0 ? item.durationMinutes : 45) * 60 * 1000
    const examConclusionMs = startMs + durMs
    return now > examConclusionMs + thresholdMs
  }

  // 3. Announcements or posts without explicit due date
  const baseMs = parseDateToMs(item.publish_at || item.created_at || item.createdAt)
  if (baseMs !== null) {
    return now > baseMs + thresholdMs
  }

  return false
}

export function getDaysRemaining(
  item: {
    due_at?: string
    dueDate?: string
    scheduledEndTime?: string
    scheduledStartTime?: string
    created_at?: string
    createdAt?: string
    publish_at?: string
    durationMinutes?: number
  },
  daysThreshold = 5
): number {
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000
  const now = Date.now()
  const targetDateStr =
    item.dueDate ||
    item.scheduledEndTime ||
    item.scheduledStartTime ||
    item.due_at ||
    item.publish_at ||
    item.created_at ||
    item.createdAt
  const targetMs = parseDateToMs(targetDateStr)
  if (targetMs === null) return daysThreshold
  const expireMs = targetMs + thresholdMs
  const diffDays = Math.ceil((expireMs - now) / (24 * 60 * 60 * 1000))
  return Math.max(0, diffDays)
}

