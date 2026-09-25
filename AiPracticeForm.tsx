import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { generatePractice, generateSamplePreview, generateAnnouncement } from '../aiPractice'
import TextbookManager from './TextbookManager'
import TeacherExamBuilder from './TeacherExamBuilder'

export default function AiPracticeForm({
  teacherPassword,
  students = [],
  onDone,
  onCancel,
}: {
  teacherPassword: string
  students?: any[]
  onDone: () => void
  onCancel: () => void
}) {
  const [subTab, setSubTab] = useState<'exam' | 'practice' | 'announcement' | 'books'>('exam')
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState('5')
  const [difficulty, setDifficulty] = useState('medium')
  const [bookId, setBookId] = useState('')
  const [books, setBooks] = useState<any[]>([])

  const [preview, setPreview] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState<{ title: string; body: string; type: string } | null>(null)
  const [err, setErr] = useState('')
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    supabase.from('textbooks').select('*').order('subject').then(({ data }) => setBooks(data || []))
  }, [subTab])

  const selectedBook = books.find((b) => b.id === bookId)

  async function handlePreview() {
    if (!topic.trim()) return
    setErr('')
    setPreviewing(true)
    setPreview('')
    try {
      const text = await generateSamplePreview({ topic: topic.trim(), difficulty, bookUrl: selectedBook?.file_path })
      setPreview(text)
    } catch (error: any) {
      setErr(error.message)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    setErr('')
    setGenerating(true)
    setDraft(null)
    try {
      if (subTab === 'announcement') {
        const text = await generateAnnouncement({ topic: topic.trim() })
        const lines = text.split('\n').filter((l) => l.trim() !== '')
        setDraft({ title: lines[0]?.trim() || 'اعلان', body: lines.slice(1).join('\n').trim(), type: 'announcement' })
      } else {
        const text = await generatePractice({ topic: topic.trim(), count, difficulty, bookUrl: selectedBook?.file_path })
        const lines = text.split('\n')
        const title = lines[0].trim() || 'تمرین'
        const body = lines.slice(1).join('\n').trim()
        setDraft({ title, body, type: 'homework' })
      }
    } catch (error: any) {
      setErr(error.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handlePublish() {
    if (!draft) return
    setPublishing(true)
    setErr('')
    const { error } = await supabase.rpc('teacher_create_post', {
      p_password: teacherPassword,
      p_type: draft.type,
      p_title: draft.title,
      p_body: draft.body,
      p_due_at: null,
      p_publish_at: new Date().toISOString(),
      p_attachment_path: null,
    })
    setPublishing(false)
    if (error) {
      setErr('خطا: ' + error.message)
      return
    }
    onDone()
  }

  return (
    <div style={{ textAlign: 'right' }}>
      {/* Modern Segmented Sub-tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 8,
          marginBottom: 20,
          background: '#F1F5F9',
          padding: 6,
          borderRadius: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setSubTab('exam')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 900,
            cursor: 'pointer',
            border: 'none',
            background: subTab === 'exam' ? '#FFFFFF' : 'transparent',
            color: subTab === 'exam' ? '#2563EB' : '#475569',
            boxShadow: subTab === 'exam' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          📝 آزمون‌ساز هوشمند و تصحیح
        </button>

        <button
          type="button"
          onClick={() => setSubTab('practice')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 900,
            cursor: 'pointer',
            border: 'none',
            background: subTab === 'practice' ? '#FFFFFF' : 'transparent',
            color: subTab === 'practice' ? '#059669' : '#475569',
            boxShadow: subTab === 'practice' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          📚 تولید تمرین و تکلیف
        </button>

        <button
          type="button"
          onClick={() => setSubTab('announcement')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 900,
            cursor: 'pointer',
            border: 'none',
            background: subTab === 'announcement' ? '#FFFFFF' : 'transparent',
            color: subTab === 'announcement' ? '#D97706' : '#475569',
            boxShadow: subTab === 'announcement' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          📢 نگارش اعلان کلاسی
        </button>

        <button
          type="button"
          onClick={() => setSubTab('books')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 900,
            cursor: 'pointer',
            border: 'none',
            background: subTab === 'books' ? '#FFFFFF' : 'transparent',
            color: subTab === 'books' ? '#7C3AED' : '#475569',
            boxShadow: subTab === 'books' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          📖 کتاب‌های مرجع پایه ۶
        </button>
      </div>

      {/* SUBTAB 1: EXAM BUILDER */}
      {subTab === 'exam' && (
        <TeacherExamBuilder
          teacherPassword={teacherPassword}
          students={students}
          onDone={onDone}
        />
      )}

      {/* SUBTAB 2 & 3: PRACTICE OR ANNOUNCEMENT */}
      {(subTab === 'practice' || subTab === 'announcement') && (
        <div style={{ background: '#FFFFFF', padding: 20, borderRadius: 18, border: '1.5px solid #CBD5E1', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 4px 0', color: '#0F172A' }}>
              {subTab === 'practice' ? '✨ تولید هوشمند تمرین و کاربرگ درسی' : '📢 نگارش هوشمند اعلان و اطلاعیه کلاسی'}
            </h3>
            <p style={{ fontSize: 12.5, color: '#64748B', margin: 0 }}>
              موضوع دلخواه خود را بنویسید تا هوش مصنوعی بر اساس کتب درسی پایه ششم آن را نگارش کند.
            </p>
          </div>

          {!draft ? (
            <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6, color: '#1E293B' }}>
                  {subTab === 'practice' ? 'موضوع یا مبحث تمرین مد نظر:' : 'موضوع اعلان کلاسی:'}
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={
                    subTab === 'practice'
                      ? 'مثلاً: ۱۰ سوال درباره مساحت دایره و محیط آن در پایه ششم، با درجه دشواری مناسب'
                      : 'مثلاً: یادآوری آوردن وسایل آزمایشگاه علوم برای روز یکشنبه'
                  }
                  rows={3}
                  required
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '1.5px solid #CBD5E1',
                    fontSize: 14,
                    boxSizing: 'border-box',
                    minHeight: 80,
                    outline: 'none',
                    lineHeight: 1.6,
                  }}
                />
              </div>

              {subTab === 'practice' && (
                <>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>تعداد سؤال</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={count}
                        onChange={(e) => setCount(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontSize: 13.5, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>سطح سختی</label>
                      <select
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontSize: 13.5, boxSizing: 'border-box' }}
                      >
                        <option value="easy">ساده و پایه‌ای</option>
                        <option value="medium">متوسط استاندارد پایه ششم</option>
                        <option value="hard">سخت و تیزهوشانی</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>
                      کتاب مرجع برای استخراج محتوا (اختیاری):
                    </label>
                    <select
                      value={bookId}
                      onChange={(e) => setBookId(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontSize: 13.5, boxSizing: 'border-box' }}
                    >
                      <option value="">— بدون پیوست کتاب خاص —</option>
                      {books.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.subject} — {b.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={handlePreview}
                      disabled={previewing || !topic.trim()}
                      style={{ fontSize: 12.5, padding: '6px 14px' }}
                    >
                      {previewing ? 'در حال نگارش نمونه...' : '👀 مشاهده یک سوال نمونه سریع'}
                    </button>
                  </div>

                  {preview && (
                    <div
                      style={{
                        background: '#F8FAFC',
                        borderRadius: 12,
                        padding: 14,
                        fontSize: 13,
                        border: '1px solid #E2E8F0',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6,
                      }}
                    >
                      {preview}
                    </div>
                  )}
                </>
              )}

              {err && <div style={{ color: '#DC2626', background: '#FEE2E2', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 800 }}>{err}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn" disabled={generating} style={{ flex: 2, padding: '12px' }}>
                  {generating
                    ? 'در حال تولید محتوا توسط هوش مصنوعی...'
                    : subTab === 'practice'
                    ? '✨ تولید تمرین کامل و ارسال به کلاس'
                    : '✨ نگارش متن رسمی اعلان'}
                </button>
                <button type="button" className="btn secondary" onClick={onCancel} disabled={generating} style={{ flex: 1, padding: '12px' }}>
                  انصراف
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>عنوان</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                  متن پیشنهادی هوش مصنوعی (قابل ویرایش پیش از انتشار):
                </label>
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 10,
                    border: '1.5px solid #CBD5E1',
                    minHeight: 160,
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {err && <div style={{ color: '#DC2626', background: '#FEE2E2', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 800 }}>{err}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn" onClick={handlePublish} disabled={publishing} style={{ flex: 2, padding: '12px' }}>
                  {publishing ? 'در حال ثبت در کلاس...' : '🚀 تایید و انتشار در کلاس'}
                </button>
                <button type="button" className="btn secondary" onClick={() => setDraft(null)} disabled={publishing} style={{ flex: 1, padding: '12px' }}>
                  🔄 تولید مجدد
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4: TEXTBOOK MANAGER */}
      {subTab === 'books' && (
        <div style={{ background: '#FFFFFF', padding: 18, borderRadius: 18, border: '1.5px solid #CBD5E1' }}>
          <TextbookManager teacherPassword={teacherPassword} onChanged={() => {}} />
        </div>
      )}
    </div>
  )
}
