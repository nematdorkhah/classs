import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function NewStudentForm({
  teacherPassword,
  onDone,
  onCancel,
}: {
  teacherPassword: string
  onDone: () => void
  onCancel: () => void
}) {
  const [fullName, setFullName] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !accessCode.trim()) return
    const { error } = await supabase.rpc('teacher_add_student', {
      p_password: teacherPassword,
      p_full_name: fullName.trim(),
      p_access_code: accessCode.trim(),
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
        <label>نام دانش‌آموز</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <label>کد ملی (به‌عنوان رمز ورود اولیه)</label>
        <input value={accessCode} onChange={(e) => setAccessCode(e.target.value)} inputMode="numeric" placeholder="مثلاً 0123456789" required />
        {err && <div className="error-text">{err}</div>}
        <div className="form-row" style={{ marginTop: 16 }}>
          <button className="btn" type="submit">افزودن</button>
          <button className="btn secondary" type="button" onClick={onCancel}>انصراف</button>
        </div>
      </form>
    </div>
  )
}
