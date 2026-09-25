import { useEffect, useRef, useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { getJalaliDateLabel, sanitizeFileName } from '../useJalaliDate'
import { computeStreak, computeBadges, groupSkillMastery, getHomeworkStatus } from '../masteryHelpers'
import MobileHeader from '../components/MobileHeader'
import MobileTabBar from '../components/MobileTabBar'
import PostsBoard from '../components/PostsBoard'
import TizhooshanPrep from '../components/TizhooshanPrep'
import StudentExamTaker from '../components/StudentExamTaker'
import LoadingScreen from '../components/LoadingScreen'
import AttachmentViewerModal from '../components/AttachmentViewerModal'
import ExamReviewModal from '../components/ExamReviewModal'
import MathRenderer from '../components/MathRenderer'
import { Exam } from '../types/examTypes'
import { fetchPublishedExams, getStudentExamSubmission, sanitizeExamTitle, getLocalExams, getLocalSubmissions } from '../utils/examStore'
import { isItemExpiredForStudent } from '../utils/expiration'
import { sanitizeTeacherFeedback } from '../utils/cleanFeedback'
import { toPersianDigits } from '../utils/persianNumbers'


type StudentTab = 'home' | 'tizhooshan' | 'homework' | 'grades' | 'profile'

export default function StudentDashboard({
  student,
  onLogout,
  onStudentUpdate,
}: {
  student: any
  onLogout: () => void
  onStudentUpdate?: (s: any) => void
}) {
  const { weekday, jalali } = getJalaliDateLabel()
  const [activeTab, setActiveTab] = useState<StudentTab>('home')
  const [posts, setPosts] = useState<any[]>([])
  const [mySubmissions, setMySubmissions] = useState<any[]>([])
  const [myGrades, setMyGrades] = useState<any[]>([])
  const [myAttendance, setMyAttendance] = useState<any[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [takingExam, setTakingExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendingPostId, setSendingPostId] = useState<string | null>(null)
  const [stagedFiles, setStagedFiles] = useState<Record<string, File>>({})
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [expandedHomeworkId, setExpandedHomeworkId] = useState<string | null>(null)
  const [viewingAttachmentUrl, setViewingAttachmentUrl] = useState<string | null>(null)
  const [viewingAttachmentTitle, setViewingAttachmentTitle] = useState<string>('فایل پیوست')
  const [reviewExamData, setReviewExamData] = useState<{ exam: any; submission: any } | null>(null)
  const hasLoadedOnce = useRef(false)

  // Profile Avatar State
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`student_avatar_${student.id}`)
    } catch {
      return null
    }
  })

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      setAvatarUrl(dataUrl)
      try {
        localStorage.setItem(`student_avatar_${student.id}`, dataUrl)
      } catch (err) {
        console.warn('Failed to save avatar to localStorage', err)
      }
    }
    reader.readAsDataURL(file)
  }

  const [oldCode, setOldCode] = useState('')
  const [newCode, setNewCode] = useState('')
  const [codeMsg, setCodeMsg] = useState('')
  const [codeBusy, setCodeBusy] = useState(false)

  async function loadAll() {
    if (!hasLoadedOnce.current) setLoading(true)
    const [p, sub, g, att, examList] = await Promise.all([
      supabase.rpc('list_published_posts'),
      supabase.rpc('student_list_my_submissions', {
        p_student_id: student.id,
        p_access_code: student.access_code,
      }),
      supabase.rpc('student_list_my_grades', {
        p_student_id: student.id,
        p_access_code: student.access_code,
      }),
      supabase.rpc('student_list_my_attendance', {
        p_student_id: student.id,
        p_access_code: student.access_code,
      }),
      fetchPublishedExams(),
    ])
    setPosts(p.data || [])
    setMySubmissions(sub.data || [])
    setMyGrades(g.data || [])
    setMyAttendance(att.data || [])
    setExams(examList || [])
    hasLoadedOnce.current = true
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stageFile(postId: string, file: File) {
    setStagedFiles((s) => ({ ...s, [postId]: file }))
  }

  function cancelStaged(postId: string) {
    setStagedFiles((s) => {
      const copy = { ...s }
      delete copy[postId]
      return copy
    })
  }

  async function sendHomework(postId: string) {
    const file = stagedFiles[postId]
    const note = (noteDrafts[postId] || '').trim()
    if (!file && !note) {
      alert('لطفاً متن پاسخ یا فایل پیوست را وارد کنید.')
      return
    }
    setSendingPostId(postId)
    try {
      let path = 'text_only'
      if (file) {
        path = `${student.id}/${postId}-${Date.now()}-${sanitizeFileName(file.name)}`
        const { error: uploadError } = await supabase.storage.from('submissions').upload(path, file)
        if (uploadError) throw uploadError
      }

      const { error } = await supabase.rpc('student_submit_homework', {
        p_student_id: student.id,
        p_access_code: student.access_code,
        p_post_id: postId,
        p_file_url: path,
        p_note: note || (path === 'text_only' ? 'پاسخ متنی دانش‌آموز' : null),
      })
      if (error) throw error
      cancelStaged(postId)
      await loadAll()
    } catch (err) {
      alert('ارسال ناموفق بود، لطفاً مجدداً امتحان کنید.')
      console.error(err)
    } finally {
      setSendingPostId(null)
    }
  }

  async function changeAccessCode(e: React.FormEvent) {
    e.preventDefault()
    if (!oldCode.trim() || !newCode.trim()) return
    setCodeBusy(true)
    const { data, error } = await supabase.rpc('student_change_code', {
      p_student_id: student.id,
      p_old_code: oldCode.trim(),
      p_new_code: newCode.trim(),
    })
    setCodeBusy(false)
    if (error) {
      setCodeMsg('خطا: ' + error.message)
      return
    }
    setCodeMsg('رمز عبور با موفقیت به‌روزرسانی شد ✓')
    setOldCode('')
    setNewCode('')
    if (onStudentUpdate) onStudentUpdate(data)
  }

  // Combined grades merging Supabase grades with local exam scores
  const combinedGrades = useMemo(() => {
    const localExams = getLocalExams()
    const examSubs = getLocalSubmissions().filter((s) => s.studentId === student.id)
    const examMap = new Map(localExams.map((e) => [e.id, e]))
    const subMap = new Map(examSubs.map((s) => [s.examId, s]))

    // Process existing Supabase grades with matched exams
    const list = myGrades.map((g) => {
      let matchedExam = g.exam || null
      let matchedSub = g.sub || null

      if (!matchedExam) {
        matchedExam =
          localExams.find((e) => {
            if (g.examId && e.id === g.examId) return true
            if (g.id && (`exam_sub_${e.id}` === g.id || `exam_${e.id}` === g.id)) return true
            const cleanE = sanitizeExamTitle(e.title, e.subject)
            const cleanG = sanitizeExamTitle(g.skill || '', g.subject)
            return cleanE && cleanG && (cleanE === cleanG || g.skill?.includes(cleanE))
          }) || null
      }

      if (matchedExam && !matchedSub) {
        matchedSub = subMap.get(matchedExam.id) || null
      }

      return {
        ...g,
        matchedExam,
        matchedSub,
      }
    })

    // Add local exam submissions not yet in list
    for (const sub of examSubs) {
      const exam = examMap.get(sub.examId)
      if (!exam) continue
      const score = sub.teacherGrading?.totalScore ?? sub.aiGrading?.totalScore ?? (sub as any).studentScore
      if (score === undefined || score === null) continue
      const rawMax = Number(exam.totalPoints || (exam as any).totalScore) || 20
      // Exact formula: Score = (Earned / Total) * 20
      const scaledScore = rawMax > 0 ? Math.round(((Number(score) / rawMax) * 20) * 10) / 10 : Number(score)
      const cleanTitle = sanitizeTeacherFeedback(sanitizeExamTitle(exam.title, exam.subject))

      const exists = list.some(
        (g) => g.skill === `آزمون: ${cleanTitle}` || g.skill === cleanTitle || g.examId === exam.id || g.matchedExam?.id === exam.id
      )
      if (!exists) {
        list.push({
          id: `exam_sub_${sub.id}`,
          student_id: student.id,
          subject: exam.subject || 'عمومی',
          skill: `آزمون: ${cleanTitle}`,
          score: scaledScore,
          max_score: 20,
          recorded_at: sub.submittedAt || new Date().toISOString(),
          is_exam: true,
          examId: exam.id,
          matchedExam: exam,
          matchedSub: sub,
          exam,
          sub,
        })
      }
    }
    return list
  }, [myGrades, student.id])

  // Teacher report card recommendation note
  const reportNote = useMemo(() => {
    try {
      const raw = localStorage.getItem(`teacher_report_note_${student.id}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.active && parsed.text?.trim()) return sanitizeTeacherFeedback(parsed.text.trim())
      }
    } catch {
      // ignore
    }
    return null
  }, [student.id, activeTab])


  // Active posts (announcements)
  const activePosts = useMemo(() => {
    return posts.filter((p) => !isItemExpiredForStudent(p, 5))
  }, [posts])

  const announcementPosts = useMemo(() => {
    return activePosts.filter((p) => p.type === 'announcement')
  }, [activePosts])

  // Unsubmitted homeworks are ALWAYS shown so student can still submit them (marked past due if late).
  // Submitted homeworks are cleaned up after 5 days so they don't pile up.
  const homeworkPosts = useMemo(() => {
    const submittedIds = new Set(mySubmissions.map((s) => s.post_id))
    return posts.filter((p) => {
      if (p.type !== 'homework') return false
      if (!submittedIds.has(p.id)) return true
      return !isItemExpiredForStudent(p, 5)
    })
  }, [posts, mySubmissions])

  // Exams are visible for 3 days after scheduled date/deadline, then archived to report card only!
  const activeExams = useMemo(() => {
    return exams.filter((e) => !isItemExpiredForStudent(e, 3))
  }, [exams])

  const submittedIds = new Set(mySubmissions.map((s) => s.post_id))
  const pendingCount = homeworkPosts.filter((p) => !submittedIds.has(p.id)).length

  const streak = computeStreak(homeworkPosts, mySubmissions)
  const badges = computeBadges(streak, combinedGrades, myAttendance)
  const skillGroups = groupSkillMastery(combinedGrades)

  const gpa = useMemo(() => {
    if (!combinedGrades.length) return null
    const total = combinedGrades.reduce((sum, g) => sum + (g.score / g.max_score) * 20, 0)
    return (total / combinedGrades.length).toFixed(1)
  }, [combinedGrades])

  const attendanceStats = useMemo(() => {
    const present = myAttendance.filter((a) => a.status === 'present').length
    const late = myAttendance.filter((a) => a.status === 'late').length
    const absent = myAttendance.filter((a) => a.status === 'absent').length
    return { present, late, absent }
  }, [myAttendance])

  const tabs = [
    { id: 'home', label: 'خانه', icon: '🏠' },
    { id: 'tizhooshan', label: 'تیزهوشان', icon: '🦉' },
    { id: 'homework', label: 'تکالیف', icon: '📝', badge: pendingCount || undefined },
    { id: 'grades', label: 'کارنامه', icon: '📊' },
    { id: 'profile', label: 'حساب من', icon: '👤' },
  ]

  if (loading) {
    return (
      <div className="mobile-app-shell">
        <LoadingScreen message="در حال دریافت اطلاعات دانش‌آموز..." />
      </div>
    )
  }

  return (
    <div className="mobile-app-shell">
      {/* Mobile Top Header */}
      <MobileHeader
        title={student.full_name}
        subtitle="پایه ششم دبستان حضرت قائم (عج)"
        userBadge="دانش‌آموز"
        dateLabel={`${weekday}، ${jalali}`}
        onLogout={onLogout}
      />

      <main className="mobile-main-content">
        {/* TAB 1: HOME */}
        {activeTab === 'home' && (
          <div className="mobile-tab-pane">
            {/* Student Welcome Hero Card */}
            <div className="mobile-hero-card">
              <div className="mobile-hero-badge">
                <span className="status-dot" /> کلاس ششم دبستان
              </div>
              <h2 className="mobile-hero-title">
                سلام {student.full_name.split(' ')[0]} عزیز! 👋
              </h2>
              <p className="mobile-hero-desc">
                {pendingCount > 0
                  ? `تو ${pendingCount} تکلیف انجام‌نشده داری. وقتشه با ارسال تکالیفت امتیاز بگیری!`
                  : 'آفرین! تمام تکالیف فعال تا این لحظه ارسال شده‌اند.'}
              </p>

              {/* Badges strip */}
              {badges.length > 0 && (
                <div className="badge-row" style={{ marginTop: 14, justifyContent: 'center' }}>
                  {badges.map((b) => (
                    <span className="badge-chip" key={b}>
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tizhooshan Quick Launcher */}
            <div
              className="duolingo-home-banner"
              onClick={() => setActiveTab('tizhooshan')}
              style={{
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#FFFFFF',
                borderRadius: 18,
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 6px 16px rgba(16, 185, 129, 0.28)',
                margin: '12px 0 18px',
                transition: 'transform 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 36, lineHeight: 1 }}>🦉</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                    باشگاه و چالش استعداد تحلیلی تیزهوشان
                  </div>
                  <div style={{ fontSize: 12.5, opacity: 0.95, marginTop: 3 }}>
                    بانک سوالات طبقه‌بندی شده سمپاد + تمرین نامحدود بی‌پایان ♾️
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, background: 'rgba(255,255,255,0.25)', padding: '8px 14px', borderRadius: 12, whiteSpace: 'nowrap' }}>
                ورود به چالش 🚀
              </span>
            </div>

            {/* Online Exams Section */}
            {activeExams.length > 0 && (
              <div style={{ margin: '18px 0' }}>
                <div className="mobile-pane-header">
                  <h3 className="mobile-pane-title">📝 آزمون‌های آنلاین کلاسی</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activeExams.map((exam) => {
                    const sub = getStudentExamSubmission(exam.id, student.id)
                    const isSubmitted = Boolean(sub)
                    const isApproved = sub?.teacherGrading?.approved
                    const isStarted = new Date(exam.scheduledStartTime).getTime() <= Date.now()

                    return (
                      <div
                        key={exam.id}
                        className="mobile-card hard"
                        style={{
                          padding: 16,
                          borderRadius: 16,
                          background: '#FFFFFF',
                          border: '2px solid var(--black)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 800, background: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: 999 }}>
                              {exam.subject}
                            </span>
                            <h4 style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', margin: '4px 0' }}>
                              {sanitizeExamTitle(exam.title, exam.subject)}
                            </h4>
                          </div>

                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: 999,
                              background: isApproved ? '#DCFCE7' : isSubmitted ? '#DCFCE7' : isStarted ? '#DBEAFE' : '#F1F5F9',
                              color: isApproved ? '#166534' : isSubmitted ? '#166534' : isStarted ? '#1E40AF' : '#475569',
                            }}
                          >
                            {isApproved
                              ? `✅ نمره نهایی: ${sub?.teacherGrading?.totalScore} از ${exam.totalPoints}`
                              : isSubmitted
                              ? '✅ ارسال شد'
                              : isStarted
                              ? '🟢 آماده برگزاری'
                              : '⏰ شروع به زودی'}
                          </span>
                        </div>

                        <p style={{ fontSize: 12.5, color: '#64748B', margin: '0 0 12px 0' }}>
                          {exam.questions.length} سوال ({exam.totalPoints} نمره) • مدت آزمون: {exam.durationMinutes} دقیقه • زمان شروع: {new Date(exam.scheduledStartTime).toLocaleString('fa-IR')}
                        </p>

                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          {isSubmitted && (
                            <button
                              type="button"
                              className="btn"
                              style={{
                                flex: 1,
                                padding: '10px',
                                fontSize: 13,
                                background: '#059669',
                              }}
                              onClick={() => setReviewExamData({ exam, submission: sub })}
                            >
                              📋 مشاهده کارنامه و ریز پاسخ‌ها
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn"
                            disabled={!isStarted && !isSubmitted}
                            style={{
                              flex: isSubmitted ? 1 : undefined,
                              width: isSubmitted ? undefined : '100%',
                              padding: '10px',
                              fontSize: 13.5,
                              background: isApproved ? '#10B981' : isSubmitted ? '#3B82F6' : '#2563EB',
                            }}
                            onClick={() => setTakingExam(exam)}
                          >
                            {isApproved
                              ? '📊 بررسی در آزمون‌ساز'
                              : isSubmitted
                              ? '🔍 مشاهده آزمون ارسال‌شده'
                              : isStarted
                              ? '🚀 ورود به صفحه آزمون'
                              : '⏳ آزمون هنوز آغاز نشده است'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Teacher Announcements */}
            <div style={{ marginTop: 20 }}>
              <div className="mobile-pane-header">
                <h3 className="mobile-pane-title">📢 آخرین اعلانات آموزگار</h3>
              </div>
              <PostsBoard
                posts={announcementPosts}
                emptyText="هنوز پیامی از طرف آموزگار ثبت نشده است."
              />
            </div>
          </div>
        )}

        {/* TAB 2: HOMEWORK (تکالیف من) */}
        {activeTab === 'homework' && (
          <div className="mobile-tab-pane">
            <div className="mobile-pane-header">
              <div>
                <h2 className="mobile-pane-title">تکالیف درسی من</h2>
                <p className="mobile-pane-subtitle">
                  {pendingCount > 0
                    ? `${pendingCount} تکلیف انجام‌نشده`
                    : 'همه تکالیف فعال ارسال شده‌اند'}
                </p>
              </div>
            </div>

            {/* INTERACTIVE ASSIGNMENTS SECTION (If teacher posted assignment exams) */}
            {activeExams.filter((e) => e.mode === 'assignment').length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 18 }}>🌟</span>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#1E293B' }}>
                    تکالیف و تمرین‌های تعاملی آنلاین
                  </h3>
                </div>
                <div className="mobile-exam-list">
                  {activeExams
                    .filter((e) => e.mode === 'assignment')
                    .map((assignment) => {
                      const sub = getStudentExamSubmission(assignment.id, student.id)
                      const isSubmitted = Boolean(sub)
                      const isApproved = Boolean(sub?.teacherGrading?.approved || (sub as any)?.approved)
                      return (
                        <div
                          key={assignment.id}
                          className="mobile-exam-card hard"
                          style={{
                            background: '#EFF6FF',
                            border: '2px solid #3B82F6',
                            padding: '16px',
                            borderRadius: 14,
                            marginBottom: 10,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: '#1D4ED8',
                                  background: '#DBEAFE',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                }}
                              >
                                {assignment.subject} • تکلیف تعاملی
                              </span>
                              <h4 style={{ margin: '6px 0 2px 0', fontSize: 15, fontWeight: 900, color: '#0F172A' }}>
                                {sanitizeExamTitle(assignment.title, assignment.subject)}
                              </h4>
                            </div>
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 800,
                                padding: '4px 8px',
                                borderRadius: 8,
                                background: isApproved ? '#DCFCE7' : isSubmitted ? '#FEF3C7' : '#E2E8F0',
                                color: isApproved ? '#15803D' : isSubmitted ? '#B45309' : '#475569',
                              }}
                            >
                              {isApproved ? '✅ تایید شد' : isSubmitted ? '✓ ارسال شد' : '⭕ در انتظار حل'}
                            </span>
                          </div>

                          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                            <span>تعداد سوالات: {assignment.questions.length} سوال | بارم: {assignment.totalPoints} نمره</span>
                            {assignment.dueDate && (
                              <div style={{ marginTop: 2, color: '#2563EB', fontWeight: 700 }}>
                                ⏰ مهلت تحویل: {new Date(assignment.dueDate).toLocaleString('fa-IR')}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="btn"
                            style={{
                              width: '100%',
                              padding: '9px',
                              fontSize: 13,
                              background: '#2563EB',
                            }}
                            onClick={() => setTakingExam(assignment)}
                          >
                            {isApproved
                              ? '📊 مشاهده کارنامه و نمره تکلیف'
                              : isSubmitted
                              ? '✏️ مشاهده یا ویرایش پاسخ‌ها'
                              : '📝 ورود و شروع حل تکلیف تعاملی'}
                          </button>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {homeworkPosts.length === 0 && activeExams.filter((e) => e.mode === 'assignment').length === 0 && (
              <div className="mobile-empty-state">
                در حال حاضر تکلیفی برای کلاس تعیین نشده است.
              </div>
            )}

            <div className="mobile-homework-list">
              {homeworkPosts.map((p) => {
                const sub = mySubmissions.find((s) => s.post_id === p.id)
                const staged = stagedFiles[p.id]
                const currentText = noteDrafts[p.id] !== undefined ? noteDrafts[p.id] : (sub?.note || '')
                const isPastDue = Boolean(p.due_at && new Date(p.due_at) < new Date())
                const isExpanded = expandedHomeworkId === p.id

                return (
                  <div key={p.id} className="mobile-homework-card hard" style={{ transition: 'all 0.2s ease' }}>
                    {/* Header: Clickable to expand/collapse */}
                    <div
                      className="mobile-homework-head"
                      style={{ cursor: 'pointer', paddingBottom: isExpanded ? 8 : 4 }}
                      onClick={() => setExpandedHomeworkId(isExpanded ? null : p.id)}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, color: '#3B82F6', fontWeight: 900 }}>
                            {isExpanded ? '▼' : '◀'}
                          </span>
                          <h3 className="mobile-homework-title" style={{ margin: 0 }}>{p.title}</h3>
                        </div>
                        <span className="mobile-homework-due">
                          {p.due_at
                            ? `⏰ مهلت ارسال: ${new Date(p.due_at).toLocaleString('fa-IR')}`
                            : 'بدون محدودیت مهلت'}
                        </span>
                      </div>
                      <span className={`status-pill ${sub ? 'done' : isPastDue ? 'missing' : 'missing'}`}>
                        {sub ? '✅ ارسال شد' : isPastDue ? '⚠️ گذشته از مهلت' : '❌ ارسال نشده'}
                      </span>
                    </div>

                    {/* Collapsed Snippet */}
                    {!isExpanded && (
                      <div
                        style={{
                          marginTop: 6,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          paddingTop: 4,
                          borderTop: '1px dashed #E2E8F0',
                        }}
                        onClick={() => setExpandedHomeworkId(p.id)}
                      >
                        <p style={{ margin: 0, fontSize: 12.5, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '78%' }}>
                          {p.body ? p.body.slice(0, 65) + (p.body.length > 65 ? '...' : '') : 'جهت مشاهده سوال و ارسال پاسخ کلیک کنید...'}
                        </p>
                        <span style={{ fontSize: 12, color: '#2563EB', fontWeight: 800 }}>
                          باز کردن و حل ▼
                        </span>
                      </div>
                    )}

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div style={{ animation: 'fadeIn 0.2s ease', borderTop: '1px solid #E2E8F0', paddingTop: 10, marginTop: 6 }}>
                        {/* Question / Description */}
                        {p.body && (
                          <div className="hw-question-body">
                            <MathRenderer text={p.body} />
                          </div>
                        )}

                        {/* Attachment from Teacher with Modal Viewer */}
                        {p.attachment_path && (
                          <div style={{ marginTop: 10 }}>
                            <button
                              type="button"
                              className="upload-btn"
                              style={{
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 13,
                                background: '#EFF6FF',
                                border: '1.5px solid #3B82F6',
                                color: '#1D4ED8',
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setViewingAttachmentUrl(p.attachment_path)
                                setViewingAttachmentTitle(p.title || 'فایل پیوست تکلیف')
                              }}
                            >
                              📎 مشاهده، زوم و دانلود فایل پیوست تکلیف
                            </button>
                          </div>
                        )}

                        {/* Previously Submitted File by Student */}
                        {sub?.file_url && sub.file_url !== 'text_only' && (
                          <div style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              className="upload-btn"
                              style={{
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 12.5,
                                background: '#F0FDF4',
                                border: '1.5px solid #86EFAC',
                                color: '#166534',
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setViewingAttachmentUrl(sub.file_url)
                                setViewingAttachmentTitle(`پاسخ ارسالی شما برای ${p.title}`)
                              }}
                            >
                              👁️ مشاهده فایل ارسالی شما
                            </button>
                          </div>
                        )}

                        {/* Past Due Warning (still allows submission) */}
                        {isPastDue && !sub && (
                          <div
                            style={{
                              marginTop: 10,
                              fontSize: 12,
                              color: '#92400E',
                              background: '#FEF3C7',
                              border: '1px solid #FDE68A',
                              padding: '6px 10px',
                              borderRadius: 8,
                              fontWeight: 700,
                            }}
                          >
                            ⚠️ مهلت تحویل این تکلیف به پایان رسیده است اما هنوز می‌توانید پاسخ خود را با تاخیر ارسال کنید.
                          </div>
                        )}

                        {/* Text Answer Input (Optional or Text-Only) */}
                        <div style={{ marginTop: 14 }}>
                          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                            ✍️ پاسخ متنی یا توضیحات شما (اختیاری):
                          </label>
                          <textarea
                            rows={3}
                            placeholder="اگر می‌خواهید پاسخ خود را تایپ کنید یا توضیحی بنویسید، اینجا وارد کنید..."
                            value={currentText}
                            onChange={(e) => setNoteDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                            className="mobile-textarea"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 10,
                              border: '2px solid var(--black)',
                              fontSize: 13.5,
                              fontFamily: 'inherit',
                              lineHeight: 1.6,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        {/* Upload / Staged File & Submit Area */}
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <label
                              className="upload-btn"
                              style={{
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 13,
                                padding: '8px 14px',
                                margin: 0,
                              }}
                            >
                              <span>📷 {staged ? 'تغییر عکس یا فایل' : 'پیوست عکس یا فایل (اختیاری)'}</span>
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                style={{ display: 'none' }}
                                onChange={(e) =>
                                  e.target.files?.[0] && stageFile(p.id, e.target.files[0])
                                }
                              />
                            </label>

                            {staged && (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  fontSize: 12,
                                  background: '#F1F5F9',
                                  border: '1px solid #CBD5E1',
                                  padding: '6px 10px',
                                  borderRadius: 8,
                                }}
                              >
                                <span>📎 {staged.name} ({(staged.size / 1024).toFixed(0)} KB)</span>
                                <button
                                  type="button"
                                  className="link"
                                  style={{ color: '#EF4444', fontSize: 12, padding: 0 }}
                                  onClick={() => cancelStaged(p.id)}
                                >
                                  حذف
                                </button>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <button
                              className="btn"
                              type="button"
                              disabled={
                                sendingPostId === p.id ||
                                (!staged && !currentText.trim())
                              }
                              onClick={() => sendHomework(p.id)}
                              style={{
                                flex: 1,
                                padding: '10px',
                                fontSize: 14,
                              }}
                            >
                              {sendingPostId === p.id
                                ? 'در حال ثبت و ارسال...'
                                : sub
                                ? '🔄 به‌روزرسانی و ارسال مجدد'
                                : '🚀 ثبت و ارسال تکلیف'}
                            </button>

                            <button
                              type="button"
                              className="btn secondary"
                              onClick={() => setExpandedHomeworkId(null)}
                              style={{ padding: '10px 14px', fontSize: 13 }}
                            >
                              بستن ▲
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB 3: GRADES & REPORT CARD */}
        {activeTab === 'grades' && (
          <div className="mobile-tab-pane">
            <div className="mobile-pane-header">
              <div>
                <h2 className="mobile-pane-title">کارنامه و نمرات من</h2>
                <p className="mobile-pane-subtitle">{combinedGrades.length} نمره و ارزیابی در سامانه ثبت شده است</p>
              </div>
            </div>

            {/* Teacher Recommendation Note (If set by teacher) */}
            {reportNote && (
              <div
                className="mobile-card hard"
                style={{
                  padding: '16px 18px',
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                  border: '2px solid #F59E0B',
                  marginBottom: 16,
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400E', fontWeight: 900, fontSize: 14.5, marginBottom: 6 }}>
                  <span style={{ fontSize: 20 }}>💬</span>
                  <span>یادداشت و توصیه آموزگار محترم:</span>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: '#78350F', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {reportNote}
                </p>
              </div>
            )}

            {/* Registered Grades Overview Banner */}
            <div
              className="mobile-card hard"
              style={{
                padding: '16px 18px',
                borderRadius: 16,
                background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
                color: '#FFFFFF',
                border: '2px solid var(--black)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 800 }}>دفتر نمرات، آزمون‌ها و فعالیت‌های کلاسی</div>
                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2, color: '#F8FAFC' }}>
                  {combinedGrades.length > 0 ? `${combinedGrades.length} نمره و ارزیابی ثبت‌شده` : 'هنوز نمره‌ای ثبت نشده است'}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800, color: '#60A5FA' }}>
                پایه ششم ابتدایی
              </div>
            </div>

            {/* Skills & Subject Mastery */}
            {skillGroups.length > 0 ? (
              <div className="mobile-card-section" style={{ marginTop: 16 }}>
                <h3 className="mobile-pane-title" style={{ fontSize: 17, marginBottom: 12 }}>
                  📚 نمرات به تفکیک درس‌ها
                </h3>
                <div className="mobile-subjects-list">
                  {skillGroups.map((sg) => (
                    <div key={sg.subject} className="mobile-subject-item hard">
                      <div className="mobile-sub-header">
                        <span className="mobile-sub-name">{sg.subject}</span>
                        <span className="mobile-sub-grade">{sg.avg.toFixed(1)} از ۲۰</span>
                      </div>
                      {sg.skills.length > 0 && (
                        <div className="mobile-skills-tags">
                          {sg.skills.map((sk) => (
                            <span key={sk.skill} className="mobile-skill-tag">
                              {sk.color} {sk.skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Detailed Registered Grades List */}
                <h3 className="mobile-pane-title" style={{ fontSize: 17, marginTop: 20, marginBottom: 12 }}>
                  📝 ریز نمرات و آزمون‌های ثبت‌شده
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {combinedGrades.map((g, idx) => {
                    const rawEarned = Number(g.score) || 0
                    const rawTotal = Number(g.max_score) || 20
                    const normalized = rawTotal > 0 ? Math.round(((rawEarned / rawTotal) * 20) * 10) / 10 : rawEarned
                    let badgeColor = '#10B981'
                    let badgeLabel = 'خیلی خوب'
                    if (normalized < 12) {
                      badgeColor = '#EF4444'
                      badgeLabel = 'نیازمند تلاش'
                    } else if (normalized < 15) {
                      badgeColor = '#F59E0B'
                      badgeLabel = 'قابل قبول'
                    } else if (normalized < 18) {
                      badgeColor = '#3B82F6'
                      badgeLabel = 'خوب'
                    }

                    const hasReview = Boolean(g.matchedExam && g.matchedSub)

                    return (
                      <div
                        key={g.id || idx}
                        className="mobile-card hard"
                        style={{
                          padding: '12px 14px',
                          borderRadius: 14,
                          background: hasReview ? '#FAFCFF' : '#FFFFFF',
                          border: hasReview ? '2px solid #3B82F6' : '2px solid var(--black)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          cursor: hasReview ? 'pointer' : 'default',
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => {
                          if (hasReview) {
                            setReviewExamData({
                              exam: g.matchedExam,
                              submission: g.matchedSub,
                            })
                          }
                        }}
                        title={hasReview ? 'برای مشاهده صورت سوالات، گزینه‌ها و پاسخنامه کامل کلیک کنید' : undefined}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              background: hasReview ? '#EFF6FF' : '#F1F5F9',
                              border: hasReview ? '1.5px solid #93C5FD' : '1px solid #CBD5E1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 16,
                            }}
                          >
                            {hasReview ? '📋' : '📝'}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 900, fontSize: 14, color: '#0F172A' }}>
                                {g.subject || 'عمومی'}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  background: `${badgeColor}15`,
                                  color: badgeColor,
                                  border: `1px solid ${badgeColor}40`,
                                  padding: '1px 7px',
                                  borderRadius: 999,
                                  fontWeight: 800,
                                }}
                              >
                                {badgeLabel}
                              </span>
                            </div>
                            <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                              {sanitizeTeacherFeedback(g.skill || g.notes || 'ارزیابی مستمر و فعالیت کلاسی')}
                            </div>
                            {hasReview && (
                              <div style={{ fontSize: 11, color: '#2563EB', fontWeight: 800, marginTop: 3 }}>
                                🔍 مشاهده ریزنمرات و پاسخنامه
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: 'left', flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: 17,
                              fontWeight: 900,
                              color: normalized >= 16 ? '#15803D' : normalized >= 12 ? '#D97706' : '#DC2626',
                            }}
                          >
                            {toPersianDigits(normalized)}
                          </span>
                          <span style={{ fontSize: 12, color: '#64748B', marginRight: 3, fontWeight: 700 }}>
                            از {toPersianDigits(20)}
                          </span>
                        </div>
                      </div>
                    )
                  })}

                </div>
              </div>
            ) : (
              <div className="mobile-empty-state">
                هنوز نمره‌ای برای شما ثبت نشده است.
              </div>
            )}
          </div>
        )}

        {/* TAB: TIZHOOSHAN DUOLINGO PREP */}
        {activeTab === 'tizhooshan' && (
          <div className="mobile-tab-pane">
            <TizhooshanPrep student={student} />
          </div>
        )}

        {/* TAB 5: PROFILE & SETTINGS */}
        {activeTab === 'profile' && (
          <div className="mobile-tab-pane">
            <div className="mobile-pane-header">
              <div>
                <h2 className="mobile-pane-title">حساب کاربری</h2>
                <p className="mobile-pane-subtitle">مشخصات دانش‌آموز و تنظیمات رمز ورود</p>
              </div>
            </div>

            {/* Profile Info Card with Circular Uploadable Avatar & Centered Name */}
            <div
              className="mobile-profile-card hard"
              style={{
                textAlign: 'center',
                padding: '28px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 16,
              }}
            >
              <label
                htmlFor="student-avatar-input"
                style={{
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'inline-block',
                  margin: '0 auto 10px auto',
                }}
                title="برای انتخاب یا تغییر عکس کلیک کنید"
              >
                <div
                  style={{
                    width: 92,
                    height: 92,
                    borderRadius: '50%',
                    background: '#F1F5F9',
                    border: '3px solid var(--black)',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={student.full_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: 50 }}>🧒</span>
                  )}
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    left: 2,
                    background: '#2563EB',
                    color: '#FFFFFF',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '2px solid #FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  📷
                </div>
                <input
                  id="student-avatar-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarUpload}
                />
              </label>

              <span style={{ fontSize: 11.5, color: '#64748B', marginBottom: 6, fontWeight: 700 }}>
                برای انتخاب یا تغییر تصویر کلیک کنید
              </span>

              <h3
                className="student-name"
                style={{
                  textAlign: 'center',
                  width: '100%',
                  fontSize: 22,
                  fontWeight: 900,
                  margin: '4px 0',
                  color: 'var(--black)',
                }}
              >
                {student.full_name}
              </h3>
              <p
                className="school-info"
                style={{
                  textAlign: 'center',
                  width: '100%',
                  fontSize: 13,
                  color: '#64748B',
                  margin: '2px 0 0 0',
                }}
              >
                پایه ششم دبستان حضرت قائم (عج)
              </p>
            </div>

            {/* Change Password Form */}
            <div className="form-panel hard" style={{ marginTop: 18, padding: 18 }}>
              <h3 style={{ margin: '0 0 16px', fontFamily: 'Lalezar', fontSize: 19, textAlign: 'center', color: '#1E293B' }}>
                🔐 تغییر رمز عبور ورود
              </h3>
              <form onSubmit={changeAccessCode} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#334155', marginBottom: 6, textAlign: 'right' }}>
                    رمز عبور فعلی
                  </label>
                  <input
                    type="password"
                    value={oldCode}
                    onChange={(e) => setOldCode(e.target.value)}
                    placeholder="رمز فعلی یا کد ملی"
                    required
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 12,
                      border: '2px solid var(--black)',
                      fontSize: 14,
                      boxSizing: 'border-box',
                      textAlign: 'right',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#334155', marginBottom: 6, textAlign: 'right' }}>
                    رمز عبور جدید
                  </label>
                  <input
                    type="password"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="رمز جدید مد نظر خود را وارد کنید"
                    required
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 12,
                      border: '2px solid var(--black)',
                      fontSize: 14,
                      boxSizing: 'border-box',
                      textAlign: 'right',
                    }}
                  />
                </div>

                {codeMsg && (
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      textAlign: 'center',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: codeMsg.includes('خطا') ? '#FEE2E2' : '#DCFCE7',
                      color: codeMsg.includes('خطا') ? '#991B1B' : '#166534',
                    }}
                  >
                    {codeMsg}
                  </div>
                )}

                <button
                  className="btn"
                  type="submit"
                  disabled={codeBusy}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: 14,
                    fontWeight: 800,
                    marginTop: 4,
                  }}
                >
                  {codeBusy ? 'در حال ثبت...' : 'ذخیره رمز جدید'}
                </button>
              </form>
            </div>

            {/* Logout button */}
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={onLogout}
                style={{ color: 'var(--red)' }}
              >
                🚪 خروج از حساب کاربری
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <MobileTabBar
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as StudentTab)}
      />

      {/* Student Exam Taker Fullscreen Popup Modal */}
      {takingExam && (
        <StudentExamTaker
          exam={takingExam}
          student={student}
          onClose={() => setTakingExam(null)}
          onFinished={() => {
            loadAll()
          }}
        />
      )}

      {/* Attachment Viewer Modal for Homework and Files */}
      {viewingAttachmentUrl && (
        <AttachmentViewerModal
          url={viewingAttachmentUrl}
          title={viewingAttachmentTitle || 'فایل پیوست'}
          onClose={() => setViewingAttachmentUrl(null)}
        />
      )}
    </div>
  )
}
