import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function BulkGradeForm({
  teacherPassword,
  students,
  onDone,
  onCancel,
}: {
  teacherPassword: string
  students: any[]
  onDone: () => void
  onCancel: () => void
}) {
  const [subject, setSubject] = useState('')
  const [skill, setSkill] = useState('')
  const [maxScore, setMaxScore] = useState('20')
  const [scores, setScores] = useState<Record<string, string>>({}) // studentId -> score string
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submitAll(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim()) return
    const entries = Object.entries(scores)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .map(([student_id, score]) => ({ student_id, score: parseFloat(score) }))

    if (entries.length === 0) {
      setErr('حداقل برای یه دانش‌آموز نمره وارد کن.')
      return
    }
    const max = parseFloat(maxScore) || 20
    const outOfRange = entries.filter((entry) => isNaN(entry.score) || entry.score < 0 || entry.score > max)
    if (outOfRange.length > 0) {
      setErr(`نمره باید بین ۰ تا ${max} باشه.`)
      return
    }

    setErr('')
    setBusy(true)
    const { error } = await supabase.rpc('teacher_add_grades_bulk', {
      p_password: teacherPassword,
      p_subject: subject.trim(),
      p_skill: skill.trim() || null,
      p_max_score: max,
      p_entries: entries,
    })
    setBusy(false)
    if (error) {
      setErr('خطا: ' + error.message)
      return
    }
    onDone()
  }

  return (
    <div className="form-panel hard">
      <form onSubmit={submitAll}>
        <label>درس</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="مثلاً ریاضی" />
        <label>مهارت (اختیاری، برای همه‌ی نمره‌های این دور یکسانه)</label>
        <input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="مثلاً جمع کسرها" />
        <label>از (حداکثر نمره)</label>
        <input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} style={{ maxWidth: 120 }} />

        <div style={{ marginTop: 16, maxHeight: 420, overflowY: 'auto', border: '2px solid var(--black)', borderRadius: 12 }}>
          {students.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderBottom: i < students.length - 1 ? '2px solid var(--black)' : 'none',
              }}
            >
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{s.full_name}</span>
              <input
                type="number"
                step="0.25"
                min="0"
                max={maxScore}
                placeholder="—"
                value={scores[s.id] || ''}
                onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })}
                style={{
                  width: 80,
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: '2px solid var(--black)',
                  background: 'var(--cream)',
                  fontSize: 13.5,
                }}
              />
            </div>
          ))}
        </div>

        {err && <div className="error-text">{err}</div>}
        <div className="form-row" style={{ marginTop: 16 }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'در حال ثبت...' : 'ثبت همه'}</button>
          <button className="btn secondary" type="button" onClick={onCancel} disabled={busy}>انصراف</button>
        </div>
      </form>
    </div>
  )
}
