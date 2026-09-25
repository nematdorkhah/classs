// محاسبه‌ی پیوستگی ارسال به‌موقع تکلیف (streak) برای یه دانش‌آموز
export function computeStreak(homeworkPosts: any[], mySubmissions: any[]): number {
  const byId: Record<string, any> = {}
  mySubmissions.forEach((s) => (byId[s.post_id] = s))

  const sorted = [...homeworkPosts]
    .filter((p) => p.due_at)
    .sort((a, b) => new Date(b.due_at).getTime() - new Date(a.due_at).getTime())

  let streak = 0
  for (const p of sorted) {
    const sub = byId[p.id]
    const onTime = sub && new Date(sub.submitted_at) <= new Date(p.due_at)
    if (onTime) {
      streak++
    } else {
      break
    }
  }
  return streak
}

export function streakBadgeLabel(streak: number): string | null {
  if (streak >= 20) return '🏆 استاد پیوستگی'
  if (streak >= 10) return '🥇 ۱۰ تکلیف پشت‌سرهم'
  if (streak >= 5) return '🔥 ۵ تکلیف پشت‌سرهم'
  if (streak >= 1) return `✅ ${streak} تکلیف پشت‌سرهم`
  return null
}

// مجموعه‌ی کامل نشان‌های یه دانش‌آموز
export function computeBadges(streak: number, grades: any[], attendanceRows: any[]): string[] {
  const badges: string[] = []
  const streakLabel = streakBadgeLabel(streak)
  if (streakLabel) badges.push(streakLabel)

  const hasHighScore = grades.some((g) => g.max_score > 0 && g.score / g.max_score >= 0.95)
  if (hasHighScore) badges.push('🧠 نمره عالی')

  const presentCount = attendanceRows.filter((a) => a.status === 'present').length
  const lateCount = attendanceRows.filter((a) => a.status === 'late').length
  if (presentCount >= 5 && lateCount === 0) badges.push('⚡ بدون تاخیر')

  return badges
}

// وضعیت رنگی یه تکلیف برای یه دانش‌آموز خاص
export function getHomeworkStatus(post: any, submission: any): { color: string; label: string; key: 'missing' | 'late' | 'done' } {
  if (!submission) return { color: '🔴', label: 'ارسال نشده', key: 'missing' }
  return { color: '🟢', label: 'ارسال شد', key: 'done' }
}

export function masteryColor(avgOutOf20: number | null | undefined): string {
  if (avgOutOf20 === null || avgOutOf20 === undefined) return '⚪'
  if (avgOutOf20 >= 16) return '🟢'
  if (avgOutOf20 >= 12) return '🟡'
  return '🔴'
}

// گروه‌بندی نمرات بر اساس درس و مهارت
export function groupSkillMastery(grades: any[]): Array<{
  subject: string
  avg: number
  skills: Array<{ skill: string; avg: number; color: string }>
}> {
  const bySubject: Record<string, { subject: string; skills: Record<string, any[]>; all: any[] }> = {}
  grades.forEach((g) => {
    const subject = g.subject || 'سایر'
    const skillKey = g.skill && g.skill.trim() ? g.skill.trim() : null
    if (!bySubject[subject]) bySubject[subject] = { subject, skills: {}, all: [] }
    bySubject[subject].all.push(g)
    if (skillKey) {
      if (!bySubject[subject].skills[skillKey]) bySubject[subject].skills[skillKey] = []
      bySubject[subject].skills[skillKey].push(g)
    }
  })

  return Object.values(bySubject).map((entry) => {
    const subjectAvg =
      entry.all.reduce((sum, g) => sum + (g.score / g.max_score) * 20, 0) / (entry.all.length || 1)
    const skills = Object.entries(entry.skills).map(([skill, gs]) => {
      const avg = gs.reduce((sum, g) => sum + (g.score / g.max_score) * 20, 0) / (gs.length || 1)
      return { skill, avg, color: masteryColor(avg) }
    })
    return { subject: entry.subject, avg: subjectAvg, skills }
  })
}

// ضعیف‌ترین درس‌های کل کلاس، بر اساس میانگین همه‌ی نمرات هر درس
export function weakestSubjects(allGrades: any[], topN = 3): Array<{ subject: string; avg: number }> {
  const bySubject: Record<string, any[]> = {}
  allGrades.forEach((g) => {
    if (!bySubject[g.subject]) bySubject[g.subject] = []
    bySubject[g.subject].push(g)
  })
  const rows = Object.entries(bySubject).map(([subject, gs]) => ({
    subject,
    avg: gs.reduce((sum, g) => sum + (g.score / g.max_score) * 20, 0) / (gs.length || 1),
  }))
  rows.sort((a, b) => a.avg - b.avg)
  return rows.slice(0, topN)
}
