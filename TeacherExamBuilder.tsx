import { useState, useEffect } from 'react'
import { Exam, ExamQuestion, QuestionType, StudentExamSubmission } from '../types/examTypes'
import MathRenderer from './MathRenderer'
import {
  fetchAllExams,
  saveExam,
  deleteExam,
  generateAiExamQuestions,
  convertPracticeTextToQuestions,
  getExamSubmissions,
  approveExamSubmission,
  sanitizeExamTitle,
  isPromptLike,
} from '../utils/examStore'


const SUBJECT_PRESETS = [
  'فارسی',
  'ریاضی',
  'علوم تجربی',
  'هدیه‌های آسمان',
  'مطالعات اجتماعی',
  'هوش و استعداد تحلیلی (تیزهوشان)',
]

const TOPIC_SUGGESTIONS: Record<string, string[]> = {
  'فارسی': [
    'آرایه‌های ادبی، تشبیه و کنایه درس ۱ و ۲',
    'ستایش و فصل اول فارسی ششم',
    'دانش زبانی و دستور زبان (فعل، فاعل، مفعول)',
    'آزمون جامع نوبت اول فارسی',
  ],
  'ریاضی': [
    'کسرها و محاسبات با اعداد مخلوط',
    'اعداد اعشاری و تقسیم',
    'مساحت، حجم و اندازه‌گیری',
    'نسبت، تناسب و درصد',
  ],
  'علوم تجربی': [
    'سرگذشت دفتر من و آزمایش‌ها',
    'سفر به اعماق زمین و زلزله',
    'دستگاه گردش خون و تنفس',
    'نیرو و انرژی در زندگی روزمره',
  ],
  'هدیه‌های آسمان': [
    'یکتاپرستی و نعمت‌های پروردگار',
    'احکام نماز و روزه در پایه ششم',
    'سیره پیامبر اکرم (ص) و اهل بیت',
  ],
  'مطالعات اجتماعی': [
    'فصل دوستی و تصمیم‌گیری',
    'منابع انرژی و مصرف بهینه',
    'ایران و همسایگان',
  ],
  'هوش و استعداد تحلیلی (تیزهوشان)': [
    'هوش کلامی و درک مطلب پیشرفته',
    'الگوهای عددی و ماتریس‌های تصویری',
    'استدلال منطقی و هوش تحلیلی تیزهوشان',
  ],
}

export default function TeacherExamBuilder({
  teacherPassword,
  students,
  onDone,
  initialPracticeText,
}: {
  teacherPassword: string
  students: any[]
  onDone?: () => void
  initialPracticeText?: string
}) {
  const [exams, setExams] = useState<Exam[]>([])
  const [activeView, setActiveView] = useState<'list' | 'create' | 'review_subs'>('list')
  const [selectedExamForSubs, setSelectedExamForSubs] = useState<Exam | null>(null)
  const [selectedSubForGrading, setSelectedSubForGrading] = useState<StudentExamSubmission | null>(null)
  const [teacherScoresDraft, setTeacherScoresDraft] = useState<Record<string, number>>({})
  const [teacherNoteDraft, setTeacherNoteDraft] = useState('')
  const [gradingSuccessMsg, setGradingSuccessMsg] = useState('')

  // Creation & Editing state
  const [creatingStep, setCreatingStep] = useState<'prompt' | 'questions' | 'schedule'>('prompt')
  const [promptMode, setPromptMode] = useState<'ai_generate' | 'paste_practice'>('ai_generate')
  const [pastedPracticeText, setPastedPracticeText] = useState('')
  const [examSubject, setExamSubject] = useState(SUBJECT_PRESETS[0])
  const [examCustomTitle, setExamCustomTitle] = useState('')
  const [examTopic, setExamTopic] = useState('')
  const [examCount, setExamCount] = useState(5)
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([
    'multiple_choice',
    'fill_in_the_blank',
    'descriptive',
  ])
  const [examDifficulty, setExamDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [extraInstructions, setExtraInstructions] = useState('')
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  const [aiError, setAiError] = useState('')

  // Draft exam
  const [draftExam, setDraftExam] = useState<Exam | null>(null)
  const [confirmedQuestionIds, setConfirmedQuestionIds] = useState<Set<string>>(new Set())

  // Question editing modal
  const [editingQ, setEditingQ] = useState<ExamQuestion | null>(null)
  const [isNewQuestionModal, setIsNewQuestionModal] = useState(false)

  // Scheduling
  const [examTitle, setExamTitle] = useState('')
  const [examMode, setExamMode] = useState<'exam' | 'assignment'>('exam')
  const [isUntimed, setIsUntimed] = useState(false)
  const [assignmentDays, setAssignmentDays] = useState(5)
  const [customDueDateTime, setCustomDueDateTime] = useState('')
  const [scheduleType, setScheduleType] = useState<'now' | 'tomorrow_10' | 'tomorrow_17' | 'custom'>('tomorrow_10')
  const [customDateTime, setCustomDateTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [savingExam, setSavingExam] = useState(false)


  useEffect(() => {
    loadExams()
  }, [])

  async function loadExams() {
    const list = await fetchAllExams(teacherPassword)
    setExams(list)
  }

  function handleTopicChange(text: string) {
    setExamTopic(text)
    const lower = text.toLowerCase()
    if (
      lower.includes('ریاضی') ||
      lower.includes('کسر') ||
      lower.includes('اعشار') ||
      lower.includes('مساحت') ||
      lower.includes('محیط') ||
      lower.includes('حجم') ||
      lower.includes('تناسب') ||
      lower.includes('مختصات') ||
      lower.includes('تقارن') ||
      lower.includes('زاویه') ||
      lower.includes('احتمال') ||
      lower.includes('اعداد صحیح') ||
      lower.includes('هندسه')
    ) {
      setExamSubject('ریاضی')
    } else if (
      lower.includes('فارسی') ||
      lower.includes('شعر') ||
      lower.includes('آرایه') ||
      lower.includes('تشبیه') ||
      lower.includes('کنایه') ||
      lower.includes('مفعول') ||
      lower.includes('نهاد') ||
      lower.includes('مسند') ||
      lower.includes('انشا') ||
      lower.includes('نگارش') ||
      lower.includes('ستایش')
    ) {
      setExamSubject('فارسی')
    } else if (
      lower.includes('علوم') ||
      lower.includes('زلزله') ||
      lower.includes('سنگ') ||
      lower.includes('زمین') ||
      lower.includes('میکروسکوپ') ||
      lower.includes('سلول') ||
      lower.includes('نیرو') ||
      lower.includes('اهرم') ||
      lower.includes('انرژی') ||
      lower.includes('گردش خون') ||
      lower.includes('تنفس') ||
      lower.includes('اسید') ||
      lower.includes('کاغذ')
    ) {
      setExamSubject('علوم تجربی')
    } else if (
      lower.includes('تیزهوشان') ||
      lower.includes('المپیاد') ||
      lower.includes('هوش') ||
      lower.includes('استعداد تحلیلی') ||
      lower.includes('مکعب') ||
      lower.includes('تاس')
    ) {
      setExamSubject('هوش و استعداد تحلیلی')
    } else if (
      lower.includes('هدیه') ||
      lower.includes('دینی') ||
      lower.includes('پیامبر') ||
      lower.includes('امام') ||
      lower.includes('نماز') ||
      lower.includes('وضو') ||
      lower.includes('قرآن')
    ) {
      setExamSubject('هدیه‌های آسمان')
    } else if (
      lower.includes('اجتماعی') ||
      lower.includes('تاریخ') ||
      lower.includes('جغرافیا') ||
      lower.includes('مدنی') ||
      lower.includes('اصفهان')
    ) {
      setExamSubject('مطالعات اجتماعی')
    }
  }

  function handleToggleType(type: QuestionType) {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter((t) => t !== type))
      }
    } else {
      setSelectedTypes([...selectedTypes, type])
    }
  }

  async function handleGenerateWithAi() {
    if (!examTopic.trim()) {
      setAiError('لطفاً مبحث یا عنوان آزمون را مشخص کنید.')
      return
    }
    setAiError('')
    setIsAiGenerating(true)
    try {
      const generatedQuestions = await generateAiExamQuestions({
        subject: examSubject,
        topic: examTopic.trim(),
        count: examCount,
        types: selectedTypes,
        difficulty: examDifficulty,
        extraInstructions: extraInstructions.trim(),
      })

      const totalPoints = generatedQuestions.reduce((sum, q) => sum + q.points, 0)
      const now = new Date()
      const tomorrow10 = new Date(now)
      tomorrow10.setDate(tomorrow10.getDate() + 1)
      tomorrow10.setHours(10, 0, 0, 0)

      const rawPrompt = examTopic.trim()
      let cleanTitle = examCustomTitle.trim()
      if (!cleanTitle) {
        if (rawPrompt.length <= 30 && !isPromptLike(rawPrompt)) {
          cleanTitle = `آزمون ${examSubject} - ${rawPrompt}`
        } else {
          cleanTitle = `آزمون درس ${examSubject}`
        }
      }

      const newDraft: Exam = {
        id: `exam_${Date.now()}`,
        title: cleanTitle,
        subject: examSubject,
        description: `آزمون کلاسی شامل ${generatedQuestions.length} سوال متنوع طراحی‌شده برای دانش‌آموزان پایه ششم.`,
        scheduledStartTime: tomorrow10.toISOString(),
        durationMinutes: 30,
        questions: generatedQuestions,
        totalPoints,
        createdAt: new Date().toISOString(),
        published: false,
      }

      setDraftExam(newDraft)
      setExamTitle(newDraft.title)
      setConfirmedQuestionIds(new Set())
      setCreatingStep('questions')
    } catch (err: any) {
      setAiError('خطا در تولید با هوش مصنوعی: ' + (err.message || 'لطفاً دوباره تلاش کنید.'))
    } finally {
      setIsAiGenerating(false)
    }
  }

  function handleCreateManualBlank() {
    const now = new Date()
    const tomorrow10 = new Date(now)
    tomorrow10.setDate(tomorrow10.getDate() + 1)
    tomorrow10.setHours(10, 0, 0, 0)

    const rawPrompt = examTopic.trim()
    let cleanTitle = examCustomTitle.trim()
    if (!cleanTitle) {
      if (rawPrompt.length <= 30 && !isPromptLike(rawPrompt)) {
        cleanTitle = `آزمون ${examSubject} - ${rawPrompt}`
      } else {
        cleanTitle = `آزمون درس ${examSubject}`
      }
    }

    const blankDraft: Exam = {
      id: `exam_${Date.now()}`,
      title: cleanTitle,
      subject: examSubject,
      description: 'آزمون طراحی‌شده توسط آموزگار',
      scheduledStartTime: tomorrow10.toISOString(),
      durationMinutes: 30,
      questions: [],
      totalPoints: 0,
      createdAt: new Date().toISOString(),
      published: false,
    }

    setDraftExam(blankDraft)
    setExamTitle(blankDraft.title)
    setConfirmedQuestionIds(new Set())
    setCreatingStep('questions')
  }

  function toggleConfirmQuestion(qId: string) {
    setConfirmedQuestionIds((prev) => {
      const next = new Set(prev)
      if (next.has(qId)) next.delete(qId)
      else next.add(qId)
      return next
    })
  }

  function handleDeleteQuestion(qId: string) {
    if (!draftExam) return
    const updated = draftExam.questions.filter((q) => q.id !== qId)
    const pts = updated.reduce((sum, q) => sum + q.points, 0)
    setDraftExam({ ...draftExam, questions: updated, totalPoints: pts })
    setConfirmedQuestionIds((prev) => {
      const next = new Set(prev)
      next.delete(qId)
      return next
    })
  }

  function handleSaveQuestionModal(savedQ: ExamQuestion) {
    if (!draftExam) return
    let updatedList: ExamQuestion[] = []
    if (isNewQuestionModal) {
      updatedList = [...draftExam.questions, savedQ]
    } else {
      updatedList = draftExam.questions.map((q) => (q.id === savedQ.id ? savedQ : q))
    }
    const pts = updatedList.reduce((sum, q) => sum + q.points, 0)
    setDraftExam({ ...draftExam, questions: updatedList, totalPoints: pts })
    setEditingQ(null)
    setIsNewQuestionModal(false)
  }

  function openNewQuestionModal() {
    const newQ: ExamQuestion = {
      id: `q_${Date.now()}`,
      type: 'multiple_choice',
      question: '',
      options: ['گزینه ۱', 'گزینه ۲', 'گزینه ۳', 'گزینه ۴'],
      correctAnswer: 0,
      rubricOrHint: '',
      points: 2,
    }
    setEditingQ(newQ)
    setIsNewQuestionModal(true)
  }

  function calculateScheduledTime(): string {
    const now = new Date()
    if (scheduleType === 'now') {
      return now.toISOString()
    } else if (scheduleType === 'tomorrow_10') {
      const d = new Date(now)
      d.setDate(d.getDate() + 1)
      d.setHours(10, 0, 0, 0)
      return d.toISOString()
    } else if (scheduleType === 'tomorrow_17') {
      const d = new Date(now)
      d.setDate(d.getDate() + 1)
      d.setHours(17, 0, 0, 0)
      return d.toISOString()
    } else {
      if (customDateTime) {
        const parsed = new Date(customDateTime)
        if (!isNaN(parsed.getTime())) return parsed.toISOString()
      }
      return now.toISOString()
    }
  }

  async function handleFinalPublish() {
    if (!draftExam || draftExam.questions.length === 0) {
      alert('آزمون باید حداقل یک سوال داشته باشد.')
      return
    }
    setSavingExam(true)
    try {
      const finalStartTime = calculateScheduledTime()
      let computedDueDate: string | undefined = undefined
      if (examMode === 'assignment') {
        if (customDueDateTime) {
          const parsed = new Date(customDueDateTime)
          if (!isNaN(parsed.getTime())) computedDueDate = parsed.toISOString()
        }
        if (!computedDueDate) {
          const d = new Date()
          d.setDate(d.getDate() + (assignmentDays || 5))
          computedDueDate = d.toISOString()
        }
      }

      const isUntimedFinal = examMode === 'assignment' || isUntimed
      const readyExam: Exam = {
        ...draftExam,
        title: examTitle.trim() || draftExam.title,
        mode: examMode,
        isUntimed: isUntimedFinal,
        dueDate: computedDueDate,
        scheduledStartTime: finalStartTime,
        durationMinutes: isUntimedFinal ? 0 : (Number(durationMinutes) || 30),
        published: true,
        totalPoints: draftExam.questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0),
      }


      await saveExam(readyExam, teacherPassword)
      await loadExams()
      setDraftExam(null)
      setActiveView('list')
      setCreatingStep('prompt')
      if (onDone) onDone()
    } catch (err: any) {
      alert('خطا در ذخیره آزمون: ' + err.message)
    } finally {
      setSavingExam(false)
    }
  }

  function openSubmissionsView(exam: Exam) {
    setSelectedExamForSubs(exam)
    setSelectedSubForGrading(null)
    setActiveView('review_subs')
  }

  function startGradingSubmission(sub: StudentExamSubmission, exam: Exam) {
    setSelectedSubForGrading(sub)
    // Initialize draft scores from AI or teacher grading
    const initialScores: Record<string, number> = {}
    for (const q of exam.questions) {
      initialScores[q.id] =
        sub.teacherGrading?.questionScores[q.id] ??
        sub.aiGrading?.questionScores[q.id] ??
        0
    }
    setTeacherScoresDraft(initialScores)
    setTeacherNoteDraft(sub.teacherGrading?.teacherNotes || sub.aiGrading?.summary || '')
    setGradingSuccessMsg('')
  }

  async function handleApproveGrading() {
    if (!selectedExamForSubs || !selectedSubForGrading) return
    setGradingSuccessMsg('')
    try {
      await approveExamSubmission({
        submissionId: selectedSubForGrading.id,
        exam: selectedExamForSubs,
        studentId: selectedSubForGrading.studentId,
        approvedScores: teacherScoresDraft,
        teacherNotes: teacherNoteDraft,
        teacherPassword,
      })
      setGradingSuccessMsg('نمره با موفقیت تایید و در کارنامه دانش‌آموز ثبت شد ✓')
      // Update local state
      const updatedList = getExamSubmissions(selectedExamForSubs.id)
      const reloadedSub = updatedList.find((s) => s.id === selectedSubForGrading.id)
      if (reloadedSub) setSelectedSubForGrading(reloadedSub)
    } catch (err: any) {
      alert('خطا در ثبت نمره: ' + err.message)
    }
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {/* View Switcher Top Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${activeView === 'list' ? '' : 'secondary'}`}
          onClick={() => {
            setActiveView('list')
            loadExams()
          }}
          style={{ flex: 1, minWidth: 140, padding: '10px 14px', fontSize: 14 }}
        >
          📋 آزمون‌های تعریف‌شده ({exams.length})
        </button>

        <button
          type="button"
          className={`btn ${activeView === 'create' ? '' : 'secondary'}`}
          onClick={() => {
            setActiveView('create')
            setCreatingStep('prompt')
          }}
          style={{ flex: 1, minWidth: 160, padding: '10px 14px', fontSize: 14 }}
        >
          ✨ طراحی آزمون جدید با هوش مصنوعی
        </button>
      </div>

      {/* ========================================================
          VIEW 1: LIST OF CREATED EXAMS
          ======================================================== */}
      {activeView === 'list' && (
        <div>
          {exams.length === 0 ? (
            <div className="mobile-empty-state" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📝</div>
              <h3 style={{ fontSize: 17, fontWeight: 900, color: 'var(--black)', margin: '0 0 6px 0' }}>
                هنوز هیچ آزمونی طراحی نشده است
              </h3>
              <p style={{ fontSize: 13, color: '#64748B', maxWidth: 360, margin: '0 auto 18px auto' }}>
                می‌توانید با دستیار هوش مصنوعی تنها با وارد کردن درس و مبحث، آزمون‌های استاندارد چهارگزینه‌ای، جای خالی و تشریحی بسازید.
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setActiveView('create')
                  setCreatingStep('prompt')
                }}
              >
                🚀 شروع ساخت آزمون هوشمند
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {exams.map((exam) => {
                const subs = getExamSubmissions(exam.id)
                const pendingSubs = subs.filter((s) => !s.teacherGrading?.approved)
                const approvedSubs = subs.filter((s) => s.teacherGrading?.approved)
                const startTimeDate = new Date(exam.scheduledStartTime)
                const isUpcoming = startTimeDate.getTime() > Date.now()

                return (
                  <div
                    key={exam.id}
                    className="mobile-card hard"
                    style={{
                      padding: 16,
                      background: '#FFFFFF',
                      borderRadius: 16,
                      border: '2px solid var(--black)',
                      boxShadow: '0 4px 0 var(--black)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span
                            style={{
                              background: '#DBEAFE',
                              color: '#1E40AF',
                              fontSize: 12,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 999,
                            }}
                          >
                            {exam.subject}
                          </span>
                          <span
                            style={{
                              background: exam.mode === 'assignment' ? '#ECFDF5' : isUpcoming ? '#FEF3C7' : '#DCFCE7',
                              color: exam.mode === 'assignment' ? '#065F46' : isUpcoming ? '#92400E' : '#166534',
                              fontSize: 12,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 999,
                            }}
                          >
                            {exam.mode === 'assignment'
                              ? '📝 تکلیف تعاملی'
                              : isUpcoming
                              ? '⏳ زمان‌بندی شده'
                              : '🟢 آزمون فعال'}
                          </span>
                        </div>
                        <h3 style={{ fontSize: 16, fontWeight: 900, margin: '2px 0 6px 0', color: '#0F172A' }}>
                          {sanitizeExamTitle(exam.title, exam.subject)}
                        </h3>
                        <p style={{ fontSize: 12.5, color: '#64748B', margin: 0 }}>
                          {exam.mode === 'assignment' && exam.dueDate ? (
                            <>🗓️ مهلت تحویل: {new Date(exam.dueDate).toLocaleDateString('fa-IR')} • ❓ {exam.questions.length} سوال ({exam.totalPoints} نمره)</>
                          ) : (
                            <>⏰ شروع: {startTimeDate.toLocaleString('fa-IR')} • ⏱️ مدت: {exam.durationMinutes} دقیقه • ❓ {exam.questions.length} سوال ({exam.totalPoints} نمره)</>
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const cleanName = sanitizeExamTitle(exam.title, exam.subject)
                          if (confirm(`آیا از حذف آزمون «${cleanName}» مطمئن هستید؟`)) {
                            deleteExam(exam.id)
                            loadExams()
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#EF4444',
                          cursor: 'pointer',
                          fontSize: 16,
                          padding: 4,
                        }}
                        title="حذف آزمون"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Submissions & Actions Bar */}
                    <div
                      style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: '1px solid #E2E8F0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <div style={{ fontSize: 13 }}>
                        <strong>پاسخ‌های دریافتی:</strong>{' '}
                        <span style={{ color: pendingSubs.length > 0 ? '#DC2626' : '#166534', fontWeight: 800 }}>
                          {subs.length} پاسخ ({pendingSubs.length} نیازمند تایید معلم)
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn secondary"
                          style={{
                            fontSize: 13,
                            padding: '6px 12px',
                          }}
                          onClick={() => {
                            setDraftExam(exam)
                            setExamTitle(sanitizeExamTitle(exam.title, exam.subject))
                            setDurationMinutes(exam.durationMinutes)
                            setConfirmedQuestionIds(new Set(exam.questions.map((q) => q.id)))
                            setActiveView('create')
                            setCreatingStep('questions')
                          }}
                          title="ویرایش یا افزودن سوالات بیشتر به این آزمون"
                        >
                          ✏️ ویرایش و افزودن سوال ({exam.questions.length})
                        </button>

                        <button
                          type="button"
                          className="btn"
                          style={{
                            fontSize: 13,
                            padding: '6px 14px',
                            background: pendingSubs.length > 0 ? '#F59E0B' : '#3B82F6',
                          }}
                          onClick={() => openSubmissionsView(exam)}
                        >
                          🔍 بررسی و تصحیح نمرات ({subs.length})
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          VIEW 2: CREATE / EDIT EXAM FLOW
          ======================================================== */}
      {activeView === 'create' && (
        <div className="mobile-card hard" style={{ padding: 18, background: '#FFFFFF', borderRadius: 18 }}>
          {/* Steps Indicator */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1.5px solid #F1F5F9', paddingBottom: 12 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: creatingStep === 'prompt' ? '#2563EB' : '#94A3B8',
              }}
            >
              ۱. تنظیم موضوع و هوش مصنوعی
            </span>
            <span>➔</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: creatingStep === 'questions' ? '#2563EB' : '#94A3B8',
              }}
            >
              ۲. بررسی، ویرایش و تایید سوالات
            </span>
            <span>➔</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: creatingStep === 'schedule' ? '#2563EB' : '#94A3B8',
              }}
            >
              ۳. زمان‌بندی و انتشار
            </span>
          </div>

          {/* STEP 1: PROMPT & GENERATION */}
          {creatingStep === 'prompt' && (
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 14px 0' }}>
                {examMode === 'assignment' || isUntimed
                  ? 'طراحی تکلیف تعاملی بدون زمان با موتور آزمون'
                  : 'طراحی آزمون کلاسی با مدل هوش مصنوعی'}
              </h3>

              {/* Exam vs Untimed Interactive Assignment selector */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 900, marginBottom: 8, color: '#0F172A' }}>
                  قالب ایجاد:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  <div
                    onClick={() => {
                      setExamMode('exam')
                      setIsUntimed(false)
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      border: examMode === 'exam' && !isUntimed ? '2.5px solid #2563EB' : '1.5px solid #CBD5E1',
                      background: examMode === 'exam' && !isUntimed ? '#EFF6FF' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 14, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⏱️ آزمون رسمی زمان‌دار</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
                      شامل تایمر ثانیه‌شمار و محدودیت زمانی در حین پاسخگویی
                    </p>
                  </div>

                  <div
                    onClick={() => {
                      setExamMode('assignment')
                      setIsUntimed(true)
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      border: examMode === 'assignment' || isUntimed ? '2.5px solid #16A34A' : '1.5px solid #CBD5E1',
                      background: examMode === 'assignment' || isUntimed ? '#F0FDF4' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 14, color: '#15803D', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🌱 تکلیف تعاملی بدون زمان</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
                      دقیقاً با موتور آزمون (تستی، جای خالی، تشریحی) بدون استرس تایمر و با مهلت چند روزه
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>درس</label>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SUBJECT_PRESETS.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setExamSubject(sub)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 800,
                        border: '2px solid var(--black)',
                        background: examSubject === sub ? '#DBEAFE' : '#FFFFFF',
                        color: examSubject === sub ? '#1E40AF' : '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                  عنوان آزمون (برای نمایش در بالای صفحه دانش‌آموز)
                </label>
                <input
                  type="text"
                  value={examCustomTitle}
                  onChange={(e) => setExamCustomTitle(e.target.value)}
                  placeholder={`مثلاً: آزمون کلاسی ${examSubject} فصل ۳ یا آزمون جامع استعداد تحلیلی`}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 10,
                    border: '2px solid var(--black)',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, display: 'block' }}>
                  این عنوان رسمی در بالای آزمون دانش‌آموز نمایش داده می‌شود (اختیاری).
                </span>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                  دستور یا موضوع شما به هوش مصنوعی (پرامپت)
                </label>
                <textarea
                  value={examTopic}
                  onChange={(e) => handleTopicChange(e.target.value)}
                  placeholder="مثلاً: سوالات هوش ریاضی و تحلیلی، ضرب کسرها، یا ۱۰ سوال تستی با پاسخ تشریحی..."
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '2px solid var(--black)',
                    fontSize: 14,
                    minHeight: 80,
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: 11.5, color: '#059669', fontWeight: 700, marginTop: 4, display: 'block' }}>
                  🛡️ این پرامپت فقط برای راهنمایی هوش مصنوعی است و به دانش‌آموز نشان داده نمی‌شود.
                </span>

                {TOPIC_SUGGESTIONS[examSubject] && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#64748B', marginBottom: 4 }}>
                      موضوعات پیشنهادی برای {examSubject}:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {TOPIC_SUGGESTIONS[examSubject].map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setExamTopic(sug)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            background: examTopic === sug ? '#EFF6FF' : '#F1F5F9',
                            border: examTopic === sug ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
                            color: examTopic === sug ? '#1D4ED8' : '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                    تعداد سوالات
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={examCount}
                    onChange={(e) => setExamCount(Math.max(1, parseInt(e.target.value) || 5))}
                    style={{
                      width: '100%',
                      padding: 10,
                      borderRadius: 10,
                      border: '2px solid var(--black)',
                      fontSize: 14,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ flex: 2, minWidth: 220 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                    تنوع انواع سوالات در آزمون
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleToggleType('multiple_choice')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        border: '1.5px solid var(--black)',
                        background: selectedTypes.includes('multiple_choice') ? '#FEF08A' : '#F1F5F9',
                        cursor: 'pointer',
                      }}
                    >
                      {selectedTypes.includes('multiple_choice') ? '✓ ' : ''}چهارگزینه‌ای
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleType('fill_in_the_blank')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        border: '1.5px solid var(--black)',
                        background: selectedTypes.includes('fill_in_the_blank') ? '#BAE6FD' : '#F1F5F9',
                        cursor: 'pointer',
                      }}
                    >
                      {selectedTypes.includes('fill_in_the_blank') ? '✓ ' : ''}جای خالی
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleType('descriptive')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        border: '1.5px solid var(--black)',
                        background: selectedTypes.includes('descriptive') ? '#BBF7D0' : '#F1F5F9',
                        cursor: 'pointer',
                      }}
                    >
                      {selectedTypes.includes('descriptive') ? '✓ ' : ''}تشریحی
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleType('image')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        border: '1.5px solid var(--black)',
                        background: selectedTypes.includes('image') ? '#FED7AA' : '#F1F5F9',
                        cursor: 'pointer',
                      }}
                    >
                      {selectedTypes.includes('image') ? '✓ ' : ''}آپلود عکس/تصویری
                    </button>
                  </div>
                </div>
              </div>

              {/* سطح دشواری و دستورات تکمیلی معلم */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                    سطح دشواری آزمون
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { id: 'easy', label: '🟢 ساده و مفهومی' },
                      { id: 'medium', label: '🟡 استاندارد ششم' },
                      { id: 'hard', label: '🔴 تیزهوشانی و پیشرفته' },
                    ].map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setExamDifficulty(lvl.id as any)}
                        style={{
                          flex: 1,
                          padding: '8px 6px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 800,
                          border: examDifficulty === lvl.id ? '2px solid #2563EB' : '1px solid #CBD5E1',
                          background: examDifficulty === lvl.id ? '#EFF6FF' : '#F8FAFC',
                          color: examDifficulty === lvl.id ? '#1D4ED8' : '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                    دستورات و توضیحات خاص به هوش مصنوعی (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={extraInstructions}
                    onChange={(e) => setExtraInstructions(e.target.value)}
                    placeholder="مثلاً: مسئله‌های کاربردی با عدد، تله‌های آموزشی، تمرکز روی ابیات شعر و..."
                    style={{
                      width: '100%',
                      padding: 10,
                      borderRadius: 10,
                      border: '1.5px solid #CBD5E1',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {aiError && (
                <div style={{ color: '#DC2626', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                  {aiError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={isAiGenerating}
                  onClick={handleGenerateWithAi}
                  style={{ flex: 2, padding: '12px 18px', fontSize: 15 }}
                >
                  {isAiGenerating ? '🤖 هوش مصنوعی در حال طراحی سوالات...' : '✨ تولید هوشمند آزمون با هوش مصنوعی'}
                </button>

                <button
                  type="button"
                  className="btn secondary"
                  disabled={isAiGenerating}
                  onClick={handleCreateManualBlank}
                  style={{ flex: 1, padding: '12px 14px', fontSize: 13 }}
                >
                  ➕ ایجاد آزمون خالی
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW, EDIT, CONFIRM QUESTIONS */}
          {creatingStep === 'questions' && draftExam && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>
                    بررسی و ویرایش سوالات آزمون ({draftExam.questions.length} سوال)
                  </h3>
                  <p style={{ fontSize: 12.5, color: '#64748B', margin: '4px 0 0 0' }}>
                    می‌توانید تک‌تک سوالات را مشاهده، تایید، ویرایش، حذف کرده یا سوال جدید دستی اضافه کنید.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: confirmedQuestionIds.size === draftExam.questions.length && draftExam.questions.length > 0 ? '#DCFCE7' : '#FEF3C7',
                      color: confirmedQuestionIds.size === draftExam.questions.length && draftExam.questions.length > 0 ? '#166534' : '#92400E',
                    }}
                  >
                    تایید شده: {confirmedQuestionIds.size} از {draftExam.questions.length}
                  </span>

                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      const allIds = new Set(draftExam.questions.map((q) => q.id))
                      setConfirmedQuestionIds(allIds)
                    }}
                    style={{ fontSize: 12.5, padding: '6px 12px' }}
                  >
                    ✓ تایید همه سوالات
                  </button>

                  <button
                    type="button"
                    className="btn secondary"
                    onClick={openNewQuestionModal}
                    style={{ fontSize: 12.5, padding: '6px 12px' }}
                  >
                    ➕ افزودن سوال جدید
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {draftExam.questions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, background: '#F8FAFC', borderRadius: 12 }}>
                    هنوز سوالی اضافه نشده است. روی «افزودن سوال جدید» کلیک کنید.
                  </div>
                ) : (
                  draftExam.questions.map((q, idx) => {
                    const isConfirmed = confirmedQuestionIds.has(q.id)
                    return (
                      <div
                        key={q.id}
                        style={{
                          padding: 14,
                          borderRadius: 14,
                          border: isConfirmed ? '2px solid #10B981' : '1.5px solid #CBD5E1',
                          background: isConfirmed ? '#F0FDF4' : '#FFFFFF',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 900, color: '#1E293B' }}>
                              سوال {idx + 1}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background:
                                  q.type === 'multiple_choice'
                                    ? '#FEF08A'
                                    : q.type === 'fill_in_the_blank'
                                    ? '#BAE6FD'
                                    : q.type === 'image'
                                    ? '#FED7AA'
                                    : '#BBF7D0',
                                color: '#1E293B',
                              }}
                            >
                              {q.type === 'multiple_choice'
                                ? 'چهارگزینه‌ای'
                                : q.type === 'fill_in_the_blank'
                                ? 'جای خالی'
                                : q.type === 'image'
                                ? 'آپلود عکس/تصویری'
                                : 'تشریحی'}
                            </span>
                            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>
                              ({q.points} نمره)
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => toggleConfirmQuestion(q.id)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 800,
                                border: '1.5px solid',
                                borderColor: isConfirmed ? '#059669' : '#CBD5E1',
                                background: isConfirmed ? '#10B981' : '#FFFFFF',
                                color: isConfirmed ? '#FFFFFF' : '#334155',
                                cursor: 'pointer',
                              }}
                            >
                              {isConfirmed ? '✓ تایید شده' : 'تایید سوال'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQ(q)
                                setIsNewQuestionModal(false)
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 8,
                                fontSize: 12,
                                background: '#F1F5F9',
                                border: '1px solid #CBD5E1',
                                cursor: 'pointer',
                              }}
                            >
                              ✏️ ویرایش
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(q.id)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 8,
                                fontSize: 12,
                                background: '#FEE2E2',
                                border: '1px solid #FCA5A5',
                                color: '#DC2626',
                                cursor: 'pointer',
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 8, lineHeight: 1.8 }}>
                          <MathRenderer text={q.question} />
                        </div>

                        {/* Options preview for multiple choice */}
                        {q.type === 'multiple_choice' && q.options && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6, margin: '8px 0' }}>
                            {q.options.map((opt, optIdx) => {
                              const isCorrect = Number(q.correctAnswer) === optIdx
                              return (
                                <div
                                  key={optIdx}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    fontSize: 12.5,
                                    background: isCorrect ? '#DCFCE7' : '#F8FAFC',
                                    border: isCorrect ? '1.5px solid #22C55E' : '1px solid #E2E8F0',
                                    fontWeight: isCorrect ? 800 : 500,
                                    color: isCorrect ? '#166534' : '#334155',
                                  }}
                                >
                                  {optIdx + 1}) <MathRenderer text={opt} /> {isCorrect && '✓ (پاسخ صحیح)'}
                                </div>
                              )
                            })}
                          </div>
                        )}


                        {q.type === 'fill_in_the_blank' && (
                          <div style={{ fontSize: 12.5, color: '#0369A1', background: '#F0F9FF', padding: '6px 10px', borderRadius: 8 }}>
                            🔑 کلیدواژه جای خالی: <strong>{String(q.correctAnswer || 'تعیین نشده')}</strong>
                          </div>
                        )}

                        {q.rubricOrHint && (
                          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 6 }}>
                            💡 کلید و راهنمای تصحیح سوال: {q.rubricOrHint}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Bottom Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setCreatingStep('prompt')}
                >
                  ➔ بازگشت به تنظیمات
                </button>

                <button
                  type="button"
                  className="btn"
                  disabled={draftExam.questions.length === 0}
                  onClick={() => setCreatingStep('schedule')}
                  style={{ padding: '10px 20px' }}
                >
                  مرحله بعد: زمان‌بندی و انتشار آزمون 🚀
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SCHEDULE & PUBLISH */}
          {creatingStep === 'schedule' && draftExam && (
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 14px 0' }}>
                زمان‌بندی برگزاری آزمون برای دانش‌آموزان
              </h3>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 900, marginBottom: 8, color: '#0F172A' }}>
                  نوع آزمون یا تکلیف:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
                  <div
                    onClick={() => {
                      setExamMode('exam')
                      setIsUntimed(false)
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: examMode === 'exam' && !isUntimed ? '2.5px solid #2563EB' : '1.5px solid #CBD5E1',
                      background: examMode === 'exam' && !isUntimed ? '#EFF6FF' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 13.5, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⏱️ آزمون زمان‌دار کلاسی</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: 11.5, color: '#64748B', lineHeight: 1.5 }}>
                      تایمر ثانیه‌شمار و محدودیت زمانی در طول برگزاری آزمون
                    </p>
                  </div>

                  <div
                    onClick={() => {
                      setExamMode('assignment')
                      setIsUntimed(true)
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: examMode === 'assignment' || isUntimed ? '2.5px solid #16A34A' : '1.5px solid #CBD5E1',
                      background: examMode === 'assignment' || isUntimed ? '#F0FDF4' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 13.5, color: '#15803D', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🌱 تکلیف تعاملی بدون زمان</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: 11.5, color: '#64748B', lineHeight: 1.5 }}>
                      موتور آزمون (تستی، جای خالی، تشریحی) بدون استرس تایمر و با مهلت چند روزه
                    </p>
                  </div>

                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                  {examMode === 'assignment' ? 'عنوان تکلیف تعاملی' : 'عنوان آزمون'}
                </label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 10,
                    border: '2px solid var(--black)',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                  زمان فعال‌شدن آزمون
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => setScheduleType('tomorrow_10')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 800,
                      border: '2px solid var(--black)',
                      background: scheduleType === 'tomorrow_10' ? '#DBEAFE' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    فردا ساعت ۱۰:۰۰ صبح (پیشنهادی) ☀️
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleType('tomorrow_17')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 800,
                      border: '2px solid var(--black)',
                      background: scheduleType === 'tomorrow_17' ? '#DBEAFE' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    فردا ساعت ۱۷:۰۰ عصر 🌇
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleType('now')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 800,
                      border: '2px solid var(--black)',
                      background: scheduleType === 'now' ? '#DCFCE7' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    همین الان فعال شود 🟢
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleType('custom')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 800,
                      border: '2px solid var(--black)',
                      background: scheduleType === 'custom' ? '#DBEAFE' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    انتخاب تاریخ دلخواه 📅
                  </button>
                </div>

                {scheduleType === 'custom' && (
                  <input
                    type="datetime-local"
                    value={customDateTime}
                    onChange={(e) => setCustomDateTime(e.target.value)}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: '2px solid var(--black)',
                      fontSize: 14,
                    }}
                  />
                )}
              </div>

              {examMode === 'exam' ? (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                    مدت زمان پاسخگویی دانش‌آموز (به دقیقه)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(5, parseInt(e.target.value) || 30))}
                    style={{
                      width: 140,
                      padding: 10,
                      borderRadius: 10,
                      border: '2px solid var(--black)',
                      fontSize: 14,
                    }}
                  />
                  <span style={{ marginRight: 8, fontSize: 13, color: '#64748B' }}>دقیقه</span>
                </div>
              ) : (
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      background: '#F0FDF4',
                      border: '1.5px solid #BBF7D0',
                      padding: '10px 14px',
                      borderRadius: 12,
                      marginBottom: 12,
                      fontSize: 12.5,
                      color: '#166534',
                      lineHeight: 1.6,
                    }}
                  >
                    🌱 <strong>تکلیف تعاملی بدون استرس و تایمر:</strong> دانش‌آموز سوالات تستی، جای خالی و تشریحی را دقیقاً با موتور آزمون اما با آرامش و بدون محدودیت زمانی حل می‌کند و می‌تواند در طول مهلت تعیین‌شده پاسخ‌های خود را تکمیل و ویرایش نماید.
                  </div>

                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                    مهلت تحویل و ویرایش توسط دانش‌آموز (پایان فرصت)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>

                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentDays(2)
                        setCustomDueDateTime('')
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 800,
                        border: '2px solid var(--black)',
                        background: assignmentDays === 2 && !customDueDateTime ? '#DCFCE7' : '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      ۲ روز مهلت ⏳
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentDays(5)
                        setCustomDueDateTime('')
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 800,
                        border: '2px solid var(--black)',
                        background: assignmentDays === 5 && !customDueDateTime ? '#DCFCE7' : '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      ۵ روز مهلت (پیشنهادی) 🗓️
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentDays(7)
                        setCustomDueDateTime('')
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 800,
                        border: '2px solid var(--black)',
                        background: assignmentDays === 7 && !customDueDateTime ? '#DCFCE7' : '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      ۱ هفته مهلت 📅
                    </button>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#64748B', display: 'block', marginBottom: 4 }}>
                      یا انتخاب مهلت دقیق تاریخ و ساعت:
                    </label>
                    <input
                      type="datetime-local"
                      value={customDueDateTime}
                      onChange={(e) => setCustomDueDateTime(e.target.value)}
                      style={{
                        padding: 8,
                        borderRadius: 10,
                        border: '2px solid var(--black)',
                        fontSize: 13,
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setCreatingStep('questions')}
                >
                  ➔ بازگشت به سوالات
                </button>

                <button
                  type="button"
                  className="btn"
                  disabled={savingExam}
                  onClick={handleFinalPublish}
                  style={{ padding: '12px 24px', fontSize: 15 }}
                >
                  {savingExam ? 'در حال ثبت آزمون...' : '🚀 انتشار آزمون در کلاس درس'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          VIEW 3: REVIEW & APPROVE SUBMISSIONS (TEACHER APPROVAL PANEL)
          ======================================================== */}
      {activeView === 'review_subs' && selectedExamForSubs && (
        <div className="mobile-card hard" style={{ padding: 18, background: '#FFFFFF', borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <button
                type="button"
                className="link"
                onClick={() => {
                  setSelectedSubForGrading(null)
                  setActiveView('list')
                }}
                style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}
              >
                ➔ بازگشت به لیست آزمون‌ها
              </button>
              <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>
                بررسی پاسخ‌های آزمون: {selectedExamForSubs.title}
              </h3>
            </div>
          </div>

          {/* If a specific student submission is open for grading */}
          {selectedSubForGrading ? (
            <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 16, border: '2px solid var(--black)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: '#0F172A' }}>
                    پاسخ‌نامه {selectedSubForGrading.studentName}
                  </h4>
                  <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0 0' }}>
                    تاریخ ارسال: {new Date(selectedSubForGrading.submittedAt).toLocaleString('fa-IR')}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: selectedSubForGrading.teacherGrading?.approved ? '#DCFCE7' : '#FEF3C7',
                      color: selectedSubForGrading.teacherGrading?.approved ? '#166534' : '#92400E',
                    }}
                  >
                    {selectedSubForGrading.teacherGrading?.approved
                      ? '✓ تایید و در کارنامه ثبت شده'
                      : '✅ ارسال شد (نیاز به بازبینی و تایید)'}
                  </span>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setSelectedSubForGrading(null)}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    بستن کارنامه
                  </button>
                </div>
              </div>

              {/* Questions Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {selectedExamForSubs.questions.map((q, idx) => {
                  const sAnswer = selectedSubForGrading.answers[q.id]
                  const aiScore = selectedSubForGrading.aiGrading?.questionScores[q.id] ?? 0
                  const aiFeedback = selectedSubForGrading.aiGrading?.questionFeedbacks[q.id]
                  const currentTeacherScore = teacherScoresDraft[q.id] ?? aiScore

                  return (
                    <div
                      key={q.id}
                      style={{
                        background: '#FFFFFF',
                        border: '1.5px solid #CBD5E1',
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: '#1E293B' }}>
                          سوال {idx + 1}: {q.question} ({q.points} نمره)
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>نمره آموزگار:</span>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max={q.points}
                            value={currentTeacherScore}
                            onChange={(e) =>
                              setTeacherScoresDraft({
                                ...teacherScoresDraft,
                                [q.id]: Math.min(q.points, Math.max(0, parseFloat(e.target.value) || 0)),
                              })
                            }
                            style={{
                              width: 60,
                              padding: '4px 6px',
                              borderRadius: 6,
                              border: '2px solid var(--black)',
                              fontSize: 13,
                              fontWeight: 800,
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ fontSize: 12 }}>از {q.points}</span>
                        </div>
                      </div>

                      {/* Student's answer display */}
                      <div style={{ background: '#F1F5F9', padding: '10px 12px', borderRadius: 8, margin: '8px 0', fontSize: 13 }}>
                        <strong>پاسخ دانش‌آموز:</strong>{' '}
                        {q.type === 'multiple_choice' ? (
                          <span>
                            گزینه {Number(sAnswer?.selectedOption ?? -1) + 1}
                            {q.options && sAnswer?.selectedOption !== undefined
                              ? ` (${q.options[sAnswer.selectedOption]})`
                              : ''}
                          </span>
                        ) : (
                          <span>{sAnswer?.textAnswer || 'بدون پاسخ متنی'}</span>
                        )}

                        {sAnswer?.imageAttachment && (
                          <div style={{ marginTop: 8 }}>
                            <img
                              src={sAnswer.imageAttachment}
                              alt="تصویر پاسخ"
                              style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }}
                            />
                          </div>
                        )}
                      </div>

                      {/* AI evaluation suggestion */}
                      {aiFeedback && (
                        <div style={{ fontSize: 12, color: '#0369A1', background: '#F0F9FF', padding: '6px 10px', borderRadius: 6 }}>
                          💡 تحلیل پاسخ و نمره پیشنهادی ({aiScore} از {q.points}): {aiFeedback}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Teacher Summary Notes & Approve Button */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '2px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 800 }}>
                    یادداشت و توصیه من برای دانش‌آموز (جهت درج در کارنامه)
                  </label>
                  <span style={{ fontSize: 11.5, color: '#166534', background: '#DCFCE7', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                    ✨ پیش‌نویس بر اساس قوت و ضعف دانش‌آموز آماده شده — قابل ویرایش
                  </span>
                </div>
                <textarea
                  value={teacherNoteDraft}
                  onChange={(e) => setTeacherNoteDraft(e.target.value)}
                  placeholder="یادداشت و بازخورد آموزگار برای دانش‌آموز..."
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 10,
                    border: '2px solid var(--black)',
                    fontSize: 13,
                    boxSizing: 'border-box',
                    minHeight: 70,
                    lineHeight: 1.5,
                  }}
                />

                {gradingSuccessMsg && (
                  <div style={{ color: '#166534', fontWeight: 800, fontSize: 13, margin: '10px 0' }}>
                    {gradingSuccessMsg}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>
                    مجموع نمره نهایی:{' '}
                    <span style={{ color: '#2563EB' }}>
                      {Object.values(teacherScoresDraft).reduce((sum, v) => sum + (v || 0), 0)} از {selectedExamForSubs.totalPoints}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn"
                    onClick={handleApproveGrading}
                    style={{ padding: '10px 20px', fontSize: 14 }}
                  >
                    ✅ تایید نهایی نمره و ارسال به کارنامه دانش‌آموز
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Submissions list */
            <div>
              {getExamSubmissions(selectedExamForSubs.id).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, background: '#F8FAFC', borderRadius: 12 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                    هنوز هیچ دانش‌آموزی پاسخی ارسال نکرده است
                  </h4>
                  <p style={{ fontSize: 12.5, color: '#64748B', margin: '4px 0 0 0' }}>
                    به محض اتمام آزمون توسط دانش‌آموزان، پاسخ‌ها در این صفحه نمایش داده می‌شوند.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {getExamSubmissions(selectedExamForSubs.id).map((sub) => {
                    const isApproved = sub.teacherGrading?.approved
                    const finalOrAiScore = isApproved ? sub.teacherGrading?.totalScore : sub.aiGrading?.totalScore

                    return (
                      <div
                        key={sub.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 12,
                          borderRadius: 12,
                          background: isApproved ? '#F0FDF4' : '#FFFBEB',
                          border: isApproved ? '1.5px solid #86EFAC' : '1.5px solid #FDE68A',
                          flexWrap: 'wrap',
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: '#0F172A' }}>
                            👤 {sub.studentName}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B' }}>
                            ارسال‌شده در {new Date(sub.submittedAt).toLocaleTimeString('fa-IR')} • نمره:{' '}
                            <strong>{finalOrAiScore} از {selectedExamForSubs.totalPoints}</strong>
                            {!isApproved && ' (نیازمند بررسی و تایید)'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: isApproved ? '#DCFCE7' : '#FEF3C7',
                              color: isApproved ? '#166534' : '#92400E',
                            }}
                          >
                            {isApproved ? '✓ ثبت در کارنامه' : '⏳ نیازمند تایید معلم'}
                          </span>

                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: 12, padding: '6px 12px' }}
                            onClick={() => startGradingSubmission(sub, selectedExamForSubs)}
                          >
                            {isApproved ? 'مشاهده و ویرایش نمره' : 'بررسی و تایید نمره'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL: ADD / EDIT QUESTION MODAL
          ======================================================== */}
      {editingQ && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setEditingQ(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              border: '2px solid var(--black)',
              padding: 20,
              maxWidth: 540,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 14px 0' }}>
              {isNewQuestionModal ? 'افزودن سوال جدید' : 'ویرایش سوال'}
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>نوع سوال</label>
              <select
                value={editingQ.type}
                onChange={(e) => {
                  const t = e.target.value as QuestionType
                  setEditingQ({
                    ...editingQ,
                    type: t,
                    options: t === 'multiple_choice' ? editingQ.options || ['گزینه ۱', 'گزینه ۲', 'گزینه ۳', 'گزینه ۴'] : undefined,
                  })
                }}
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '2px solid var(--black)', fontSize: 13 }}
              >
                <option value="multiple_choice">چهارگزینه‌ای</option>
                <option value="fill_in_the_blank">جای خالی</option>
                <option value="descriptive">تشریحی / متنی</option>
                <option value="image">آپلود عکس / حل تصویری</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>صورت سوال</label>
              <textarea
                value={editingQ.question}
                onChange={(e) => setEditingQ({ ...editingQ, question: e.target.value })}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '2px solid var(--black)', fontSize: 13, minHeight: 60 }}
              />
            </div>

            {/* Multiple Choice Options */}
            {editingQ.type === 'multiple_choice' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>گزینه‌ها</label>
                {(editingQ.options || ['', '', '', '']).map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <input
                      type="radio"
                      name="correctOption"
                      checked={Number(editingQ.correctAnswer) === i}
                      onChange={() => setEditingQ({ ...editingQ, correctAnswer: i })}
                      title="انتخاب به عنوان گزینه درست"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...(editingQ.options || [])]
                        newOpts[i] = e.target.value
                        setEditingQ({ ...editingQ, options: newOpts })
                      }}
                      placeholder={`گزینه ${i + 1}`}
                      style={{ flex: 1, padding: 6, borderRadius: 6, border: '1.5px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>
                ))}
                <span style={{ fontSize: 11, color: '#64748B' }}>دایره کنار گزینه صحیح را تیک بزنید.</span>
              </div>
            )}

            {editingQ.type === 'fill_in_the_blank' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                  کلیدواژه پاسخ صحیح جای خالی
                </label>
                <input
                  type="text"
                  value={String(editingQ.correctAnswer || '')}
                  onChange={(e) => setEditingQ({ ...editingQ, correctAnswer: e.target.value })}
                  placeholder="پاسخ مورد انتظار"
                  style={{ width: '100%', padding: 8, borderRadius: 8, border: '2px solid var(--black)', fontSize: 13 }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>بارم نمره</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="10"
                  value={editingQ.points}
                  onChange={(e) => setEditingQ({ ...editingQ, points: parseFloat(e.target.value) || 2 })}
                  style={{ width: '100%', padding: 8, borderRadius: 8, border: '2px solid var(--black)', fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn secondary" onClick={() => setEditingQ(null)}>
                انصراف
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (!editingQ.question.trim()) {
                    alert('لطفاً متن سوال را وارد کنید.')
                    return
                  }
                  handleSaveQuestionModal(editingQ)
                }}
              >
                ذخیره سوال
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
