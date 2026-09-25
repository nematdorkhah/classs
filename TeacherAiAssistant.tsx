import { useState, useRef, useEffect } from 'react'
import { toPersianDigits } from '../utils/persianNumbers'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  time: string
}

export default function TeacherAiAssistant({
  students,
  statsRows,
  homeworkPosts,
  grades,
  allAttendance,
  weakSubjects,
}: {
  students: any[]
  statsRows: any[]
  homeworkPosts: any[]
  grades: any[]
  allAttendance: any[]
  weakSubjects?: any[]
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `سلام همکار گرامی! 🌸
من دستیار هوشمند تحلیل کلاس و پداگوژی شما هستم. به تمامی آمار و داده‌های زنده کلاس، وضعیت ارسال تکالیف، نمرات دانش‌آموزان (در مقیاس ۲۰ نمره) و حضور و غیاب دسترسی دارم.

می‌توانید درباره هر دانش‌آموز بپرسید (مثلاً: «وضعیت علی چطوره؟») یا درباره وضعیت کلی کلاس، تکالیف ارسال‌نشده یا راهکارهای جبرانی گفتگو کنیم.`,
      time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedStudentForQuery, setSelectedStudentForQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Build the rich live context payload
  function buildClassroomContext() {
    const studentSummaries = statsRows.map((sr) => {
      const studentGrades = grades.filter((g) => g.student_id === sr.id)
      const subjectAverages: Record<string, { total: number; count: number }> = {}
      studentGrades.forEach((g) => {
        const sub = g.subject || 'عمومی'
        const normalized = g.max_score > 0 ? (g.score / g.max_score) * 20 : g.score
        if (!subjectAverages[sub]) subjectAverages[sub] = { total: 0, count: 0 }
        subjectAverages[sub].total += normalized
        subjectAverages[sub].count += 1
      })

      const subjectsBreakdown = Object.entries(subjectAverages).map(([sub, data]) => ({
        subject: sub,
        avgOutOf20: Math.round((data.total / data.count) * 10) / 10,
      }))

      const studentAbsents = allAttendance.filter(
        (a) => a.student_id === sr.id && a.status === 'absent'
      ).length

      const missingHwCount = Math.max(0, sr.totalHomework - sr.submitted)
      const hwSubmissionRate =
        sr.totalHomework > 0 ? Math.round((sr.submitted / sr.totalHomework) * 100) : 100

      return {
        id: sr.id,
        fullName: sr.name,
        avgGradeOutOf20: sr.avg !== null ? Math.round(sr.avg * 10) / 10 : 'بدون نمره',
        submittedHomeworkCount: sr.submitted,
        totalHomeworkCount: sr.totalHomework,
        missingHomeworkCount: missingHwCount,
        hwSubmissionRatePercent: hwSubmissionRate,
        presentDays: sr.present,
        lateDays: sr.late,
        absentDays: studentAbsents,
        streak: sr.streak,
        subjectScores: subjectsBreakdown,
      }
    })

    return {
      classSummary: {
        totalStudentsCount: students.length,
        totalHomeworksAssigned: homeworkPosts.length,
        totalGradesRecorded: grades.length,
        weakSubjectsIdentified: weakSubjects || [],
      },
      students: studentSummaries,
    }
  }

  async function handleSend(userText: string) {
    const trimmed = userText.trim()
    if (!trimmed || loading) return

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      text: trimmed,
      time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const context = buildClassroomContext()
      const res = await fetch('/api/ai/classroom-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          classroomContext: context,
        }),
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'خطا در ارتباط با سرور')
      }

      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        text: data.reply,
        time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: any) {
      const errorMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        text: `⚠️ متأسفانه در دریافت پاسخ مشکلی پیش آمد: ${err?.message || 'خطای اتصال'}. لطفاً مجدداً تلاش فرمایید.`,
        time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const quickPrompts = [
    'وضعیت کلی تکالیف و نمرات کلاس چطوره؟',
    'کدوم دانش‌آموزها بیشترین تکلیف ارسال‌نشده رو دارند؟',
    'کلاس در چه مباحث یا دروسی ضعف بیشتری داره؟',
    'دانش‌آموزان با انگیزه و برتر کلاس کیا هستند؟',
    'پیشنهاد تکالیف جبرانی برای بچه‌های نیازمند تلاش بده.',
  ]

  return (
    <div
      className="mobile-card hard"
      style={{
        background: '#FFFFFF',
        borderRadius: 18,
        display: 'flex',
        flexDirection: 'column',
        height: '680px',
        maxHeight: '80vh',
        overflow: 'hidden',
        border: '3px solid #0F172A',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26 }}>🤖</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#FFFFFF' }}>
              دستیار هوشمند تحلیل کلاس و دانش‌آموزان
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: '#C7D2FE' }}>
              تحلیل مستند داده‌های تکالیف، نمرات (مقیاس ۲۰) و پایش یادگیری
            </p>
          </div>
        </div>

        {/* Quick student picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select
            value={selectedStudentForQuery}
            onChange={(e) => {
              const val = e.target.value
              setSelectedStudentForQuery(val)
              if (val) {
                handleSend(`وضعیت درسی، تکالیف و نمرات «${val}» چطوره و چه تحلیلی داری؟`)
              }
            }}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              background: '#3730A3',
              color: '#FFFFFF',
              border: '1px solid #4F46E5',
            }}
          >
            <option value="">👤 بررسی وضعیت یک دانش‌آموز...</option>
            {students.map((s) => (
              <option key={s.id} value={s.full_name}>
                {s.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Prompts Bar */}
      <div
        style={{
          padding: '8px 14px',
          background: '#F1F5F9',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            type="button"
            className="upload-btn"
            style={{
              fontSize: 11.5,
              padding: '4px 10px',
              background: '#FFFFFF',
              color: '#1E293B',
              borderRadius: 999,
              borderColor: '#CBD5E1',
              flexShrink: 0,
            }}
            onClick={() => handleSend(qp)}
          >
            💡 {qp}
          </button>
        ))}
      </div>

      {/* Messages stream */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#F8FAFC',
        }}
      >
        {messages.map((m) => {
          const isUser = m.role === 'user'
          return (
            <div
              key={m.id}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: isUser ? '80%' : '90%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 16,
                  borderTopLeftRadius: !isUser ? 4 : 16,
                  borderTopRightRadius: isUser ? 4 : 16,
                  background: isUser ? '#2563EB' : '#FFFFFF',
                  color: isUser ? '#FFFFFF' : '#0F172A',
                  border: isUser ? 'none' : '1.5px solid #E2E8F0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  fontSize: 13.5,
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {toPersianDigits(m.text)}
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  color: '#94A3B8',
                  marginTop: 4,
                  padding: '0 4px',
                }}
              >
                {toPersianDigits(m.time)}
              </span>
            </div>
          )
        })}

        {loading && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '12px 16px',
              borderRadius: 16,
              background: '#FFFFFF',
              border: '1.5px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: '#6366F1',
              fontWeight: 700,
            }}
          >
            <span className="spinner" style={{ width: 16, height: 16 }} />
            در حال تحلیل داده‌های کلاس و تنظیم راهکار آموزشی...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend(input)
        }}
        style={{
          padding: '12px 14px',
          background: '#FFFFFF',
          borderTop: '2px solid #E2E8F0',
          display: 'flex',
          gap: 8,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="سوالی درباره دانش‌آموزان یا وضعیت کلاس بپرسید..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 12,
            border: '2px solid #CBD5E1',
            fontSize: 13.5,
            fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn"
          style={{
            width: 'auto',
            padding: '0 18px',
            fontSize: 14,
            opacity: loading || !input.trim() ? 0.6 : 1,
          }}
        >
          ارسال
        </button>
      </form>
    </div>
  )
}
