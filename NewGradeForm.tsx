import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function NewGradeForm({
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
  const [form, setForm] = useState({ student_id: '', subject: '', skill: '', score: '', max_score: '20' })
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.student_id || !form.subject.trim() || form.score === '') return
    const { error } = await supabase.rpc('teacher_add_grade', {
      p_password: teacherPassword,
      p_student_id: form.student_id,
      p_subject: form.subject.trim(),
      p_skill: form.skill.trim() || null,
      p_score: parseFloat(form.score),
      p_max_score: parseFloat(form.max_score) || 20,
    })
    if (error) {
      setErr('خطا: ' + error.message)
      return
    }
    onDone()
  }

  return (
    <div className="form-panel hard">
      <form onSubmit={submit}>
        <label>دانش‌آموز</label>
        <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required>
          <option value="">— انتخاب کن —</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
        <label>درس</label>
        <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
        <label>مهارت (اختیاری، مثلاً «جمع کسرها»)</label>
        <input value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })} placeholder="خالی بذاری فقط نمره کلی درس ثبت می‌شه" />
        <div className="form-row">
          <div>
            <label>نمره</label>
            <input type="number" step="0.25" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} required />
          </div>
          <div>
            <label>از</label>
            <input type="number" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} />
          </div>
        </div>
        {err && <div className="error-text">{err}</div>}
        <div className="form-row" style={{ marginTop: 16 }}>
          <button className="btn" type="submit">ثبت نمره</button>
          <button className="btn secondary" type="button" onClick={onCancel}>انصراف</button>
        </div>
      </form>
    </div>
  )
}
