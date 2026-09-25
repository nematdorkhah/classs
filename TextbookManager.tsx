import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { sanitizeFileName } from '../useJalaliDate'

export default function TextbookManager({
  teacherPassword,
  onChanged,
}: {
  teacherPassword: string
  onChanged?: () => void
}) {
  const [books, setBooks] = useState<any[]>([])
  const [subject, setSubject] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  async function loadBooks() {
    const { data } = await supabase.from('textbooks').select('*').order('subject')
    setBooks(data || [])
  }

  useEffect(() => {
    loadBooks()
  }, [])

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !title.trim() || !file) return
    setErr('')
    setUploading(true)
    try {
      const path = `textbooks/${Date.now()}-${sanitizeFileName(file.name)}`
      const { error: uploadError } = await supabase.storage.from('materials').upload(path, file)
      if (uploadError) throw uploadError
      const { data: pub } = supabase.storage.from('materials').getPublicUrl(path)
      const { error } = await supabase.rpc('teacher_add_textbook', {
        p_password: teacherPassword,
        p_subject: subject.trim(),
        p_title: title.trim(),
        p_file_path: pub.publicUrl,
      })
      if (error) throw error
      setSubject('')
      setTitle('')
      setFile(null)
      await loadBooks()
      if (onChanged) onChanged()
    } catch (error: any) {
      setErr('خطا: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('این کتاب از لیست حذف بشه؟')) return
    await supabase.rpc('teacher_delete_textbook', { p_password: teacherPassword, p_textbook_id: id })
    await loadBooks()
    if (onChanged) onChanged()
  }

  return (
    <div className="form-panel hard">
      <form onSubmit={upload}>
        <label>درس</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثلاً ریاضی" required />
        <label>عنوان کتاب</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً ریاضی ششم دبستان" required />
        <label>فایل PDF کتاب (حداکثر ۲۰ مگابایت)</label>
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
        {err && <div className="error-text">{err}</div>}
        <div className="form-row" style={{ marginTop: 16 }}>
          <button className="btn" type="submit" disabled={uploading}>{uploading ? 'در حال آپلود...' : 'افزودن کتاب'}</button>
        </div>
      </form>

      {books.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <label>کتاب‌های ثبت‌شده</label>
          <div className="hw-list" style={{ marginTop: 8 }}>
            {books.map((b) => (
              <div className="hw-item" key={b.id}>
                <div className="title">
                  <h4>{b.title}</h4>
                  <span>{b.subject}</span>
                </div>
                <button className="upload-btn" type="button" onClick={() => remove(b.id)}>🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
