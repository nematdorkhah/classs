export function sanitizeFileName(name: string): string {
  const parts = name.split('.')
  const ext = parts.length > 1 ? parts.pop() : ''
  const base = parts.join('.').replace(/[^a-zA-Z0-9آ-ی_-]/g, '_').slice(0, 60)
  return ext ? `${base}.${ext.replace(/[^a-zA-Z0-9]/g, '')}` : base
}

export function getJalaliDateLabel(): { weekday: string; jalali: string } {
  try {
    const now = new Date()
    const weekday = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(now)
    const jalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now)
    return { weekday, jalali }
  } catch {
    return { weekday: '', jalali: 'امروز' }
  }
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
