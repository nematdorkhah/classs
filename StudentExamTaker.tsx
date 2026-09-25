import { useState, useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { Exam, ExamQuestion, StudentExamAnswer, StudentExamSubmission } from '../types/examTypes'
import { getStudentExamSubmission, submitStudentExam, sanitizeExamTitle } from '../utils/examStore'
import MathRenderer from './MathRenderer'

export default function StudentExamTaker({
  exam,
  student,
  onClose,
  onFinished,
}: {
  exam: Exam
  student: any
  onClose: () => void
  onFinished?: () => void
}) {
  const [existingSubmission, setExistingSubmission] = useState<StudentExamSubmission | undefined>(undefined)
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, StudentExamAnswer>>({})
  const [timeLeftSeconds, setTimeLeftSeconds] = useState((Number(exam.durationMinutes) || 30) * 60)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [submittedResult, setSubmittedResult] = useState<StudentExamSubmission | null>(null)

  // Live ref for answers to prevent stale closures inside timer callback
  const answersRef = useRef<Record<string, StudentExamAnswer>>(answers)
  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  const isAssignment = exam.mode === 'assignment' || Boolean(exam.isUntimed) || Number(exam.durationMinutes) <= 0
  const isPastDue = Boolean(exam.dueDate && new Date(exam.dueDate) < new Date())


  useEffect(() => {
    const prevSub = getStudentExamSubmission(exam.id, student.id)
    if (prevSub) {
      setExistingSubmission(prevSub)
      setSubmittedResult(prevSub)
      if (prevSub.answers) {
        setAnswers(prevSub.answers)
        answersRef.current = prevSub.answers
      }
    }
  }, [exam.id, student.id])

  // Timer countdown (only for timed exams, not open assignments)
  useEffect(() => {
    if (isAssignment || existingSubmission || submittedResult) return
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleAutoSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isAssignment, existingSubmission, submittedResult])

  const currentQ: ExamQuestion | undefined = exam.questions[currentQIndex]
  const currentAnswer = currentQ ? answers[currentQ.id] || {} : {}

  const answeredCount = Object.keys(answers).filter((k) => {
    const a = answers[k]
    return a.selectedOption !== undefined || (a.textAnswer && a.textAnswer.trim().length > 0) || a.imageAttachment
  }).length

  function setAnswerForCurrent(field: keyof StudentExamAnswer, val: any) {
    if (!currentQ) return
    setAnswers((prev) => {
      const updated = {
        ...prev,
        [currentQ.id]: {
          ...(prev[currentQ.id] || {}),
          [field]: val,
        },
      }
      answersRef.current = updated
      return updated
    })
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setAnswerForCurrent('imageAttachment', reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function handleAutoSubmit() {
    await doSubmit(answersRef.current)
  }

  async function doSubmit(explicitAnswers?: Record<string, StudentExamAnswer>) {
    setSubmitting(true)
    setShowConfirmModal(false)
    const targetAnswers = explicitAnswers || answersRef.current || answers
    try {
      const sub = await submitStudentExam({
        exam,
        studentId: student.id,
        studentName: student.full_name,
        answers: targetAnswers,
      })
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
      setSubmittedResult(sub)
      setExistingSubmission(sub)
      if (onFinished) onFinished()
    } catch (e: any) {
      alert('خطا در ثبت آزمون: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const minutes = Math.floor(timeLeftSeconds / 60)
  const seconds = timeLeftSeconds % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  // If student has already submitted
  if (submittedResult || existingSubmission) {
    const sub = submittedResult || existingSubmission!
    const isApproved = sub.teacherGrading?.approved

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 24,
            padding: 24,
            maxWidth: 580,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '2px solid var(--black)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            textAlign: 'center',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 56, marginBottom: 12 }}>{isApproved ? '🌟' : '🎉'}</div>

          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', margin: '0 0 8px 0' }}>
            {isApproved ? 'نتیجه و نمره آزمون' : 'پاسخ‌های شما با موفقیت ثبت شد!'}
          </h2>

          <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, marginBottom: 20 }}>
            {isApproved
              ? `نمره نهایی شما: ${sub.teacherGrading?.totalScore} از ${exam.totalPoints}`
              : 'پاسخت ثبت شده است. نمره شما پس از بررسی آموزگار محترم باز خواهد شد. خیالتان راحت باشد، تمام پاسخ‌ها به دقت ثبت شده‌اند.'}
          </p>

          {/* Status Alert Card */}
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: isApproved ? '#F0FDF4' : '#FFFBEB',
              border: isApproved ? '2px solid #86EFAC' : '2px solid #FDE68A',
              marginBottom: 20,
              textAlign: 'right',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>وضعیت کارنامه:</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: isApproved ? '#DCFCE7' : '#FEF3C7',
                  color: isApproved ? '#166534' : '#92400E',
                }}
              >
                {isApproved ? '✅ نمره ثبت و قطعی شد' : '✅ ارسال شد'}
              </span>
            </div>

            {isApproved ? (
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#166534', margin: '6px 0' }}>
                  نمره نهایی: {sub.teacherGrading?.totalScore} از {exam.totalPoints}
                </div>
                {sub.teacherGrading?.teacherNotes && (
                  <div style={{ fontSize: 13, color: '#1E293B', background: '#DCFCE7', padding: '10px 14px', borderRadius: 8, marginTop: 8, lineHeight: 1.6 }}>
                    💬 <strong>یادداشت و توصیه:</strong> {sub.teacherGrading.teacherNotes}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#92400E', lineHeight: 1.6 }}>
                پاسخ‌های شما با موفقیت دریافت شد. پس از ثبت نمرات، کارنامه فعال می‌شود.
              </div>
            )}
          </div>

          {/* Question Breakdown if Approved */}
          {isApproved && (
            <div style={{ textAlign: 'right', marginBottom: 20 }}>
              <h4 style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>ریز نمرات سوالات:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {exam.questions.map((q, i) => {
                  const qScore = sub.teacherGrading?.questionScores[q.id] ?? 0
                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        fontSize: 12.5,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>
                        سوال {i + 1}: {q.question.slice(0, 45)}...
                      </span>
                      <span style={{ fontWeight: 800, color: qScore > 0 ? '#166534' : '#DC2626' }}>
                        {qScore} از {q.points}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Re-edit assignment button if assignment and before deadline */}
          {isAssignment && !isPastDue && !isApproved && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSubmittedResult(null)
                setExistingSubmission(undefined)
              }}
              style={{
                width: '100%',
                padding: '11px',
                marginBottom: 10,
                background: '#EFF6FF',
                color: '#1D4ED8',
                border: '2px solid #3B82F6',
                fontWeight: 900,
                fontSize: 13.5,
              }}
            >
              ✏️ ویرایش و تغییر پاسخ‌های تکلیف
            </button>
          )}

          <button type="button" className="btn" onClick={onClose} style={{ width: '100%', padding: '12px' }}>
            بستن و بازگشت به داشبورد
          </button>
        </div>
      </div>
    )
  }

  if (!currentQ) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.85)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 24,
          maxWidth: 620,
          width: '100%',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          border: '2px solid var(--black)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            padding: '14px 18px',
            background: '#F8FAFC',
            borderBottom: '2px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                background: '#DBEAFE',
                color: '#1E40AF',
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              {exam.subject}
            </span>
            <h3 style={{ fontSize: 15, fontWeight: 900, margin: '4px 0 0 0', color: '#0F172A' }}>
              {sanitizeExamTitle(exam.title, exam.subject)}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Timer or Untimed Status Pill */}
            {isAssignment ? (
              <div
                style={{
                  background: '#ECFDF5',
                  color: '#065F46',
                  border: '1.5px solid #A7F3D0',
                  padding: '5px 12px',
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>🌱</span>
                <span>تکلیف تعاملی بدون زمان {exam.dueDate ? `(مهلت: ${new Date(exam.dueDate).toLocaleDateString('fa-IR')})` : ''}</span>
              </div>
            ) : (
              <div
                style={{
                  background: timeLeftSeconds < 300 ? '#FEE2E2' : '#DCFCE7',
                  color: timeLeftSeconds < 300 ? '#DC2626' : '#166534',
                  border: `1.5px solid ${timeLeftSeconds < 300 ? '#F87171' : '#86EFAC'}`,
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>⏱️</span>
                <span>{formattedTime}</span>
              </div>
            )}


            <button
              type="button"
              onClick={() => {
                if (confirm('آیا می‌خواهید از محیط آزمون خارج شوید؟ پاسخ‌های کنونی شما ذخیره شده باقی می‌ماند.')) {
                  onClose()
                }
              }}
              style={{
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: 8,
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ✕ خروج موقت
            </button>
          </div>
        </div>

        {/* Progress & Quick Navigation Dots */}
        <div style={{ padding: '10px 18px', background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, color: '#64748B', marginBottom: 6 }}>
            <span>سوال {currentQIndex + 1} از {exam.questions.length}</span>
            <span>{answeredCount} از {exam.questions.length} پاسخ داده شده</span>
          </div>

          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {exam.questions.map((q, idx) => {
              const a = answers[q.id]
              const hasAns =
                a &&
                (a.selectedOption !== undefined ||
                  (a.textAnswer && a.textAnswer.trim().length > 0) ||
                  a.imageAttachment)
              const isCurrent = idx === currentQIndex

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentQIndex(idx)}
                  style={{
                    minWidth: 28,
                    height: 28,
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    border: isCurrent ? '2px solid #2563EB' : '1px solid #CBD5E1',
                    background: isCurrent ? '#EFF6FF' : hasAns ? '#DCFCE7' : '#FFFFFF',
                    color: isCurrent ? '#1D4ED8' : hasAns ? '#166534' : '#64748B',
                    cursor: 'pointer',
                  }}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        </div>

        {/* Slide Question Body */}
        <div style={{ padding: '20px 18px', flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 6,
                background:
                  currentQ.type === 'multiple_choice'
                    ? '#FEF08A'
                    : currentQ.type === 'fill_in_the_blank'
                    ? '#BAE6FD'
                    : currentQ.type === 'image'
                    ? '#FED7AA'
                    : '#BBF7D0',
                color: '#1E293B',
              }}
            >
              {currentQ.type === 'multiple_choice'
                ? 'چهارگزینه‌ای'
                : currentQ.type === 'fill_in_the_blank'
                ? 'جای خالی'
                : currentQ.type === 'image'
                ? 'تصویری / ارسال عکس'
                : 'تشریحی'}
            </span>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 800 }}>
              بارم نمره: {currentQ.points}
            </span>
          </div>

          <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', lineHeight: 1.8, margin: '0 0 16px 0' }}>
            <MathRenderer text={currentQ.question} />
          </div>

          {currentQ.imageUrl && (
            <div style={{ marginBottom: 16 }}>
              <img
                src={currentQ.imageUrl}
                alt="تصویر سوال"
                style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 12, border: '1px solid #CBD5E1' }}
              />
            </div>
          )}

          {/* INPUT 1: MULTIPLE CHOICE */}
          {currentQ.type === 'multiple_choice' && currentQ.options && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQ.options.map((opt, optIdx) => {
                const isSelected = currentAnswer.selectedOption === optIdx
                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => setAnswerForCurrent('selectedOption', optIdx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderRadius: 14,
                      fontSize: 14,
                      fontWeight: isSelected ? 800 : 600,
                      textAlign: 'right',
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #2563EB' : '1.5px solid #CBD5E1',
                      background: isSelected ? '#EFF6FF' : '#FFFFFF',
                      color: isSelected ? '#1E40AF' : '#1E293B',
                      boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.12)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        border: isSelected ? '6px solid #2563EB' : '2px solid #94A3B8',
                        background: '#FFFFFF',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1 }}>
                      <MathRenderer text={opt} />
                    </span>
                  </button>
                )
              })}
            </div>
          )}


          {/* INPUT 2: FILL IN THE BLANK */}
          {currentQ.type === 'fill_in_the_blank' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#334155', marginBottom: 8 }}>
                عبارت یا کلمه جای خالی را بنویسید:
              </label>
              <input
                type="text"
                value={currentAnswer.textAnswer || ''}
                onChange={(e) => setAnswerForCurrent('textAnswer', e.target.value)}
                placeholder="پاسخ را اینجا تایپ کنید..."
                style={{
                  width: '100%',
                  padding: 14,
                  borderRadius: 12,
                  border: '2px solid var(--black)',
                  fontSize: 15,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* INPUT 3: DESCRIPTIVE TEXT */}
          {currentQ.type === 'descriptive' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#334155', marginBottom: 8 }}>
                پاسخ تشریحی خود را بنویسید:
              </label>
              <textarea
                value={currentAnswer.textAnswer || ''}
                onChange={(e) => setAnswerForCurrent('textAnswer', e.target.value)}
                placeholder="توضیحات و پاسخ کامل خود را بنویسید..."
                style={{
                  width: '100%',
                  padding: 14,
                  borderRadius: 12,
                  border: '2px solid var(--black)',
                  fontSize: 14,
                  minHeight: 120,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* INPUT 4: IMAGE UPLOAD (PHOTO OF HANDWRITTEN ANSWER) */}
          {currentQ.type === 'image' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#334155', marginBottom: 8 }}>
                پاسخ خود را روی برگه نوشته و عکس آن را ارسال کنید (یا توضیح متنی بنویسید):
              </label>

              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    borderRadius: 12,
                    border: '2px solid var(--black)',
                    background: '#F1F5F9',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  📷 انتخاب یا گرفتن عکس از برگه پاسخ
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                </label>
              </div>

              {currentAnswer.imageAttachment && (
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
                  <img
                    src={currentAnswer.imageAttachment}
                    alt="پاسخ ارسالی"
                    style={{ maxHeight: 180, borderRadius: 12, border: '2px solid #10B981' }}
                  />
                  <button
                    type="button"
                    onClick={() => setAnswerForCurrent('imageAttachment', undefined)}
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      background: '#EF4444',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 999,
                      width: 24,
                      height: 24,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <textarea
                value={currentAnswer.textAnswer || ''}
                onChange={(e) => setAnswerForCurrent('textAnswer', e.target.value)}
                placeholder="توضیحات تکمیلی یا متن پاسخ (اختیاری)..."
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 10,
                  border: '1.5px solid #CBD5E1',
                  fontSize: 13,
                  boxSizing: 'border-box',
                  minHeight: 70,
                }}
              />
            </div>
          )}
        </div>

        {/* Bottom Slide Navigation Bar */}
        <div
          style={{
            padding: '14px 18px',
            background: '#F8FAFC',
            borderTop: '2px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <button
            type="button"
            className="btn secondary"
            disabled={currentQIndex === 0}
            onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
            style={{ padding: '10px 16px', fontSize: 13 }}
          >
            ➔ سوال قبلی
          </button>

          {currentQIndex < exam.questions.length - 1 ? (
            <button
              type="button"
              className="btn"
              onClick={() => setCurrentQIndex((prev) => Math.min(exam.questions.length - 1, prev + 1))}
              style={{ padding: '10px 20px', fontSize: 13 }}
            >
              سوال بعدی ⬅️
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => setShowConfirmModal(true)}
              style={{ padding: '10px 20px', fontSize: 14, background: '#10B981' }}
            >
              🏁 اتمام آزمون و ارسال پاسخ‌ها
            </button>
          )}
        </div>
      </div>

      {/* CONFIRMATION SUBMIT MODAL */}
      {showConfirmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              padding: 24,
              maxWidth: 440,
              width: '100%',
              border: '2px solid var(--black)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 44, marginBottom: 8 }}>📝</div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', margin: '0 0 8px 0' }}>
              آیا از اتمام و ارسال آزمون اطمینان دارید؟
            </h3>
            <p style={{ fontSize: 13.5, color: '#64748B', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              شما به <strong>{answeredCount}</strong> از <strong>{exam.questions.length}</strong> سوال پاسخ داده‌اید.
              پس از ارسال، پاسخ‌نامه شما در کارنامه ثبت خواهد شد.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowConfirmModal(false)}
                style={{ flex: 1 }}
              >
                بازگشت و بازبینی
              </button>
              <button
                type="button"
                className="btn"
                disabled={submitting}
                onClick={() => doSubmit()}
                style={{ flex: 1, background: '#10B981' }}
              >
                {submitting ? 'در حال ثبت پاسخ‌ها...' : 'تایید و ثبت نهایی 🚀'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
