import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { sanitizeFileName } from '../useJalaliDate'

const SUBJECT_TAGS = ['ریاضی', 'فارسی', 'علوم تجربی', 'هدیه‌های آسمان', 'مطالعات اجتماعی', 'عمومی']

const DUE_PRESETS = [
  { label: 'فردا شب (ساعت ۲۰:۰۰)', days: 1, time: '20:00' },
  { label: 'پس‌فردا شب (ساعت ۲۰:۰۰)', days: 2, time: '20:00' },
  { label: 'پایان هفته (پنج‌شنبه ۲۰:۰۰)', days: 4, time: '20:00' },
  { label: 'تاریخ دلخواه ⚙️', days: -1, time: '20:00' },
]

export default function NewPostForm({
  teacherPassword,
  onDone,
  onCancel,
}: {
  teacherPassword: string
  onDone: () => void
  onCancel: () => void
}) {
  const [postType, setPostType] = useState<'homework' | 'announcement'>('homework')
  const [selectedSubject, setSelectedSubject] = useState('ریاضی')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [duePresetIndex, setDuePresetIndex] = useState(0)
  const [customDueDays, setCustomDueDays] = useState(3)
  const [customDueTime, setCustomDueTime] = useState('20:00')
  const [publishLater, setPublishLater] = useState(false)
  const [publishInDays, setPublishInDays] = useState(1)
  const [publishTime, setPublishTime] = useState('08:00')
  const [file, setFile] = useState<File | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  function computeDueDate(): Date | null {
    if (postType !== 'homework') return null
    const now = new Date()
    const preset = DUE_PRESETS[duePresetIndex]
    const days = preset.days === -1 ? Number(customDueDays) || 1 : preset.days
    const timeStr = preset.days === -1 ? customDueTime : preset.time
    const [h, m] = timeStr.split(':').map(Number)
    const target = new Date(now)
    target.setDate(target.getDate() + days)
    target.setHours(h, m, 0, 0)
    return target
  }

  function computePublishDate(): Date {
    const now = new Date()
    if (!publishLater) return now
    const [h, m] = publishTime.split(':').map(Number)
    const target = new Date(now)
    target.setDate(target.getDate() + Number(publishInDays || 0))
    target.setHours(h, m, 0, 0)
    return target
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setErr('لطفاً عنوان را وارد کنید.')
      return
    }
    setErr('')
    setBusy(true)

    try {
      let attachmentPath = null
      if (file) {
        const path = `${Date.now()}-${sanitizeFileName(file.name)}`
        const { error: uploadError } = await supabase.storage.from('materials').upload(path, file)
        if (uploadError) throw uploadError
        const { data: pub } = supabase.storage.from('materials').getPublicUrl(path)
        attachmentPath = pub.publicUrl
      }

      const publishDate = computePublishDate()
      const dueDate = computeDueDate()

      const fullTitle = selectedSubject && selectedSubject !== 'عمومی' && !title.includes(selectedSubject)
        ? `[${selectedSubject}] ${title.trim()}`
        : title.trim()

      const { error } = await supabase.rpc('teacher_create_post', {
        p_password: teacherPassword,
        p_type: postType,
        p_title: fullTitle,
        p_body: body.trim(),
        p_due_at: dueDate ? dueDate.toISOString() : null,
        p_publish_at: publishDate.toISOString(),
        p_attachment_path: attachmentPath,
      })

      if (error) throw error
      onDone()
    } catch (error: any) {
      setErr('خطا در ثبت: ' + (error.message || 'لطفاً دوباره تلاش کنید.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ textAlign: 'right', padding: '4px 0' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Type Selector (Segmented Cards) */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 900, marginBottom: 8, color: '#1E293B' }}>
            نوع پست ارسالی:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              onClick={() => setPostType('homework')}
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                textAlign: 'center',
                cursor: 'pointer',
                border: postType === 'homework' ? '2.5px solid #059669' : '1.5px solid #E2E8F0',
                background: postType === 'homework' ? '#ECFDF5' : '#F8FAFC',
                boxShadow: postType === 'homework' ? '0 4px 12px rgba(5, 150, 105, 0.12)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>📝</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: postType === 'homework' ? '#065F46' : '#475569' }}>
                تکلیف درسی
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                با امکان تعیین مهلت تحویل و دریافت تکالیف
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPostType('announcement')}
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                textAlign: 'center',
                cursor: 'pointer',
                border: postType === 'announcement' ? '2.5px solid #2563EB' : '1.5px solid #E2E8F0',
                background: postType === 'announcement' ? '#EFF6FF' : '#F8FAFC',
                boxShadow: postType === 'announcement' ? '0 4px 12px rgba(37, 99, 235, 0.12)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>📢</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: postType === 'announcement' ? '#1E40AF' : '#475569' }}>
                اعلان کلاسی
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                اطلاع‌رسانی عمومی، برنامه امتحانی و یادداشت‌ها
              </div>
            </button>
          </div>
        </div>

        {/* Subject Chips */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, marginBottom: 6, color: '#334155' }}>
            درس مربوطه:
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SUBJECT_TAGS.map((sub) => {
              const isSelected = selectedSubject === sub
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSelectedSubject(sub)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: isSelected ? 900 : 700,
                    border: isSelected ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
                    background: isSelected ? '#DBEAFE' : '#FFFFFF',
                    color: isSelected ? '#1E40AF' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {sub}
                </button>
              )
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6, color: '#1E293B' }}>
            عنوان {postType === 'homework' ? 'تکلیف' : 'اعلان'} *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              postType === 'homework'
                ? 'مثلاً: تمرینات صفحه ۴۲ و ۴۳ ریاضی - جمع و تفریق کسرها'
                : 'مثلاً: یادآوری وسایل آزمایش علوم برای جلسه آینده'
            }
            required
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '2px solid #CBD5E1',
              fontSize: 14,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {/* Body */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6, color: '#1E293B' }}>
            توضیحات و متن پیام:
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="توضیحات، دستورالعمل یا نکات مربوط به این تکلیف/اعلان را بنویسید..."
            rows={4}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '2px solid #CBD5E1',
              fontSize: 13.5,
              boxSizing: 'border-box',
              minHeight: 90,
              outline: 'none',
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* Due Date Presets for Homework */}
        {postType === 'homework' && (
          <div
            style={{
              padding: 14,
              borderRadius: 14,
              background: '#F0FDF4',
              border: '1.5px solid #86EFAC',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 900, color: '#166534' }}>
              <span>⏰</span>
              <span>مهلت تحویل تکلیف:</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
              {DUE_PRESETS.map((preset, idx) => {
                const isSelected = duePresetIndex === idx
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setDuePresetIndex(idx)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: isSelected ? 900 : 700,
                      border: isSelected ? '2px solid #059669' : '1px solid #A7F3D0',
                      background: isSelected ? '#FFFFFF' : '#ECFDF5',
                      color: isSelected ? '#047857' : '#065F46',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>

            {/* Custom due settings if last preset selected */}
            {duePresetIndex === 3 && (
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#166534', marginBottom: 4 }}>
                    چند روز بعد؟
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={customDueDays}
                    onChange={(e) => setCustomDueDays(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1.5px solid #86EFAC',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#166534', marginBottom: 4 }}>
                    ساعت تحویل:
                  </label>
                  <input
                    type="time"
                    value={customDueTime}
                    onChange={(e) => setCustomDueTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1.5px solid #86EFAC',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attachment Card */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6, color: '#1E293B' }}>
            فایل یا تصویر پیوست (اختیاری):
          </label>
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              border: '2px dashed #CBD5E1',
              background: '#F8FAFC',
              textAlign: 'center',
            }}
          >
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', padding: '10px 14px', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                  <span style={{ fontSize: 20 }}>📎</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 220 }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      {(file.size / 1024).toFixed(1)} کیلوبایت
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  style={{
                    background: '#FEE2E2',
                    color: '#DC2626',
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  حذف ✕
                </button>
              </div>
            ) : (
              <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 28 }}>📁</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#2563EB' }}>
                  برای انتخاب تصویر یا فایل PDF تکلیف کلیک کنید
                </span>
                <span style={{ fontSize: 11.5, color: '#94A3B8' }}>
                  پشتیبانی از عکس برگه، اسناد PDF و کاربرگ‌ها
                </span>
                <input
                  type="file"
                  accept="image/*,video/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>
        </div>

        {/* Schedule for Future toggle */}
        <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 12, border: '1px solid #E2E8F0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 800, color: '#334155', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={publishLater}
              onChange={(e) => setPublishLater(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#2563EB' }}
            />
            <span>زمان‌بندی انتشار (ارسال با تاخیر برای تاریخی خاص)</span>
          </label>

          {publishLater && (
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
                  چند روز بعد منتشر شود؟
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={publishInDays}
                  onChange={(e) => setPublishInDays(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>ساعت انتشار:</label>
                <input
                  type="time"
                  value={publishTime}
                  onChange={(e) => setPublishTime(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {err && (
          <div style={{ color: '#DC2626', background: '#FEE2E2', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 800 }}>
            {err}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button
            type="submit"
            className="btn"
            disabled={busy}
            style={{
              flex: 2,
              padding: '13px',
              fontSize: 14.5,
              fontWeight: 900,
              background: postType === 'homework' ? '#059669' : '#2563EB',
            }}
          >
            {busy ? 'در حال ثبت...' : postType === 'homework' ? '🚀 ثبت و ارسال تکلیف به کلاس' : '📢 انتشار اعلان در کلاس'}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={onCancel}
            style={{ flex: 1, padding: '13px', fontSize: 13.5 }}
          >
            انصراف
          </button>
        </div>
      </form>
    </div>
  )
}
