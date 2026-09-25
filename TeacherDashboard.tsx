import { useMemo, useState } from 'react'
import { useClassroomData } from '../hooks/useClassroomData'
import { getJalaliDateLabel } from '../useJalaliDate'
import { computeStreak, weakestSubjects } from '../masteryHelpers'
import MobileHeader from '../components/MobileHeader'
import MobileTabBar from '../components/MobileTabBar'
import MobileModal from '../components/MobileModal'
import KpiCards from '../components/KpiCards'
import StudentMonitoringLeague from '../components/StudentMonitoringLeague'
import NewPostForm from '../components/NewPostForm'
import AiPracticeForm from '../components/AiPracticeForm'
import TeacherAiAssistant from '../components/TeacherAiAssistant'
import NewStudentForm from '../components/NewStudentForm'
import NewGradeForm from '../components/NewGradeForm'
import BulkGradeForm from '../components/BulkGradeForm'
import PostsBoard from '../components/PostsBoard'
import HomeworkStatusList from '../components/HomeworkStatusList'
import AttendanceList from '../components/AttendanceList'
import Gradebook from '../components/Gradebook'
import StudentProfilePanel from '../components/StudentProfilePanel'
import BackupRestoreModal from '../components/BackupRestoreModal'
import LoadingScreen from '../components/LoadingScreen'
import { exportClassroomToExcel } from '../utils/excelExport'
import { getLocalExams, getLocalSubmissions } from '../utils/examStore'

type TeacherTab = 'home' | 'posts' | 'attendance' | 'grades' | 'monitoring' | 'ai'

export default function TeacherDashboard({
  teacherPassword,
  onLogout,
}: {
  teacherPassword: string
  onLogout: () => void
}) {
  const { weekday, jalali } = getJalaliDateLabel()
  const {
    students,
    posts,
    submissions,
    attendanceToday,
    allAttendance,
    grades,
    loading,
    reload,
  } = useClassroomData(teacherPassword)

  const [activeTab, setActiveTab] = useState<TeacherTab>('home')
  const [showNewPost, setShowNewPost] = useState(false)
  const [showNewStudent, setShowNewStudent] = useState(false)
  const [showNewGrade, setShowNewGrade] = useState(false)
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [gradeMode, setGradeMode] = useState<'bulk' | 'single'>('bulk')
  const [openStudentId, setOpenStudentId] = useState<string | null>(null)
  const [postFilter, setPostFilter] = useState<'all' | 'homework' | 'announcement'>('all')
  const [aiSubTab, setAiSubTab] = useState<'chat' | 'exam'>('chat')

  const now = new Date()
  const publishedPosts = posts.filter((p) => new Date(p.publish_at) <= now)
  const homeworkPosts = publishedPosts.filter((p) => p.type === 'homework')

  const combinedGrades = useMemo(() => {
    const list = [...grades]
    const localExams = getLocalExams()
    const examSubs = getLocalSubmissions()
    const examMap = new Map(localExams.map((e) => [e.id, e]))
    for (const sub of examSubs) {
      const exam = examMap.get(sub.examId)
      if (!exam) continue
      const score = sub.teacherGrading?.totalScore ?? sub.aiGrading?.totalScore ?? (sub as any).studentScore
      if (score === undefined || score === null) continue
      const exists = list.some(
        (g) => g.student_id === sub.studentId && (g.skill === `آزمون: ${exam.title}` || g.skill === exam.title)
      )
      if (!exists) {
        list.push({
          id: `exam_sub_${sub.id}`,
          student_id: sub.studentId,
          subject: exam.subject || 'عمومی',
          skill: `آزمون: ${exam.title}`,
          score: Number(score),
          max_score: exam.totalPoints || 20,
          recorded_at: sub.submittedAt || new Date().toISOString(),
          is_exam: true,
        })
      }
    }
    return list
  }, [grades])

  const statsRows = useMemo(() => {
    return students.map((s) => {
      const myGrades = combinedGrades.filter((g) => g.student_id === s.id)
      const avg = myGrades.length
        ? myGrades.reduce((sum: number, g: any) => sum + (g.score / g.max_score) * 20, 0) / myGrades.length
        : null
      const mySubmissionRows = submissions.filter((sub) => sub.student_id === s.id)
      const myPresent = allAttendance.filter((a) => a.student_id === s.id && a.status === 'present').length
      const myLate = allAttendance.filter((a) => a.student_id === s.id && a.status === 'late').length
      const streak = computeStreak(homeworkPosts, mySubmissionRows)
      return {
        id: s.id,
        name: s.full_name,
        avg,
        submitted: mySubmissionRows.length,
        totalHomework: homeworkPosts.length,
        present: myPresent,
        late: myLate,
        streak,
      }
    })
  }, [students, combinedGrades, submissions, allAttendance, homeworkPosts])

  const weakSubjects = useMemo(() => weakestSubjects(combinedGrades, 3), [combinedGrades])

  const openStudent = students.find((s) => s.id === openStudentId)

  const filteredPosts = useMemo(() => {
    if (postFilter === 'all') return publishedPosts
    return publishedPosts.filter((p) => p.type === postFilter)
  }, [publishedPosts, postFilter])

  const tabs = [
    { id: 'home', label: 'داشبورد', icon: '🏠' },
    { id: 'posts', label: 'تکالیف', icon: '📢', badge: homeworkPosts.length || undefined },
    { id: 'attendance', label: 'حضور و غیاب', icon: '✅' },
    { id: 'grades', label: 'نمرات', icon: '📊' },
    { id: 'monitoring', label: 'پایش و لیگ', icon: '📈' },
    { id: 'ai', label: 'هوش مصنوعی', icon: '🤖' },
  ]

  if (loading) {
    return (
      <div className="mobile-app-shell">
        <LoadingScreen message="در حال بارگذاری اطلاعات کلاس درس..." />
      </div>
    )
  }

  return (
    <div className="mobile-app-shell">
      {/* Native Mobile Top Bar */}
      <MobileHeader
        title="کلاس ششم دبستان"
        subtitle="دبستان حضرت قائم (عج)"
        userBadge="آموزگار"
        dateLabel={`${weekday}، ${jalali}`}
        onLogout={onLogout}
      />

      {/* Main Tab Views */}
      <main className="mobile-main-content">
        {/* TAB 1: HOME (Dashboard Overview) */}
        {activeTab === 'home' && (
          <div className="mobile-tab-pane">
            {/* Hero Greeting Card */}
            <div className="mobile-hero-card">
              <div className="mobile-hero-badge">
                <span className="status-dot" /> سال تحصیلی ۱۴۰۵ - ۱۴۰۴
              </div>
              <h2 className="mobile-hero-title">
                پنل مدیریت کلاس <span style={{ color: '#60A5FA' }}>ششم ابتدایی</span>
              </h2>
              <p className="mobile-hero-desc">
                {students.length} دانش‌آموز فعال · {homeworkPosts.length} تکلیف ثبت‌شده
              </p>

              {/* Quick Actions Grid */}
              <div className="mobile-quick-actions">
                <button
                  type="button"
                  className="mobile-action-pill"
                  onClick={() => setShowNewPost(true)}
                >
                  <span className="icon">📝</span>
                  <span className="text">ارسال تکلیف</span>
                </button>
                <button
                  type="button"
                  className="mobile-action-pill"
                  onClick={() => setActiveTab('attendance')}
                >
                  <span className="icon">✅</span>
                  <span className="text">حضور امروز</span>
                </button>
                <button
                  type="button"
                  className="mobile-action-pill"
                  onClick={() => setShowNewGrade(true)}
                >
                  <span className="icon">📊</span>
                  <span className="text">ثبت نمره</span>
                </button>
                <button
                  type="button"
                  className="mobile-action-pill"
                  onClick={() => setActiveTab('monitoring')}
                >
                  <span className="icon">📈</span>
                  <span className="text">پایش و لیگ کلاسی</span>
                </button>
                <button
                  type="button"
                  className="mobile-action-pill"
                  onClick={() => setActiveTab('ai')}
                >
                  <span className="icon">🤖</span>
                  <span className="text">آزمون‌ساز هوش مصنوعی</span>
                </button>
                <button
                  type="button"
                  className="mobile-action-pill"
                  onClick={() => setShowBackupModal(true)}
                >
                  <span className="icon">💾</span>
                  <span className="text">پشتیبان‌گیری</span>
                </button>
              </div>
            </div>

            {/* Quick AI Classroom Data Analysis Card */}
            <div
              onClick={() => {
                setActiveTab('ai')
                setAiSubTab('chat')
              }}
              style={{
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
                color: '#FFFFFF',
                borderRadius: 16,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                margin: '14px 0',
                border: '2px solid #4338CA',
                boxShadow: '0 8px 20px rgba(49, 46, 129, 0.25)',
                transition: 'transform 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 32 }}>🤖</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>
                    گفتگو با هوش مصنوعی درباره دیتای کلاس
                  </div>
                  <div style={{ fontSize: 12, color: '#C7D2FE', marginTop: 2 }}>
                    تحلیل وضعیت درسی، تکالیف ارسال‌نشده، نقاط ضعف و قوت دانش‌آموزان
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                شروع تحلیل 💬
              </span>
            </div>

            {/* KPI Cards */}
            <div style={{ margin: '18px 0' }}>
              <KpiCards
                students={students}
                attendanceToday={attendanceToday}
                homeworkPosts={homeworkPosts}
                submissions={submissions}
                grades={grades}
                statsRows={statsRows}
                weakSubjects={weakSubjects}
              />
            </div>
          </div>
        )}

        {/* TAB 2: POSTS & HOMEWORK */}
        {activeTab === 'posts' && (
          <div className="mobile-tab-pane">
            <div className="mobile-pane-header">
              <div>
                <h2 className="mobile-pane-title">تکالیف و اعلانات کلاسی</h2>
                <p className="mobile-pane-subtitle">{publishedPosts.length} پیام و تکلیف در کلاس</p>
              </div>
              <button
                type="button"
                className="btn"
                style={{ width: 'auto', padding: '8px 14px', fontSize: 15 }}
                onClick={() => setShowNewPost(true)}
              >
                + پست جدید
              </button>
            </div>

            {/* Filter Pills */}
            <div className="mobile-filter-chips-row">
              <button
                type="button"
                className={`mobile-filter-chip ${postFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPostFilter('all')}
              >
                همه ({publishedPosts.length})
              </button>
              <button
                type="button"
                className={`mobile-filter-chip ${postFilter === 'homework' ? 'active' : ''}`}
                onClick={() => setPostFilter('homework')}
              >
                📐 فقط تکالیف ({homeworkPosts.length})
              </button>
              <button
                type="button"
                className={`mobile-filter-chip ${postFilter === 'announcement' ? 'active' : ''}`}
                onClick={() => setPostFilter('announcement')}
              >
                📣 اعلانات عمومی
              </button>
            </div>

            {/* Posts Board */}
            <PostsBoard
              posts={filteredPosts}
              teacherPassword={teacherPassword}
              onChanged={reload}
            />

            {/* Submissions Summary */}
            <div style={{ marginTop: 24 }}>
              <div className="mobile-pane-header">
                <h3 className="mobile-pane-title" style={{ fontSize: 18 }}>وضعیت تحویل تکالیف</h3>
              </div>
              <HomeworkStatusList
                homeworkPosts={homeworkPosts}
                submissions={submissions}
                students={students}
                onRefresh={reload}
              />
            </div>
          </div>
        )}

        {/* TAB 3: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="mobile-tab-pane">
            <div className="mobile-pane-header">
              <div>
                <h2 className="mobile-pane-title">حضور و غیاب امروز</h2>
                <p className="mobile-pane-subtitle">{weekday}، {jalali}</p>
              </div>
            </div>

            <AttendanceList
              students={students}
              attendanceToday={attendanceToday}
              teacherPassword={teacherPassword}
              onChanged={reload}
            />
          </div>
        )}

        {/* TAB 4: GRADES & GRADEBOOK */}
        {activeTab === 'grades' && (
          <div className="mobile-tab-pane">
            <div className="mobile-pane-header">
              <div>
                <h2 className="mobile-pane-title">دفتر نمرات و دانش‌آموزان</h2>
                <p className="mobile-pane-subtitle">{students.length} دانش‌آموز در کلاس</p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{
                    width: 'auto',
                    padding: '6px 12px',
                    fontSize: 13,
                    background: '#ECFDF5',
                    color: '#065F46',
                    border: '1.5px solid #10B981',
                    fontWeight: 800,
                  }}
                  onClick={() =>
                    exportClassroomToExcel({
                      students,
                      grades: combinedGrades,
                      submissions,
                      allAttendance,
                      homeworkPosts,
                    })
                  }
                  title="دانلود گزارش جامع اکسل به ترتیب الفبا"
                >
                  📊 خروجی اکسل (الفبا)
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ width: 'auto', padding: '6px 12px', fontSize: 13.5 }}
                  onClick={() => setShowNewStudent(true)}
                >
                  + دانش‌آموز
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ width: 'auto', padding: '6px 12px', fontSize: 13.5 }}
                  onClick={() => setShowNewGrade(true)}
                >
                  + ثبت نمره
                </button>
              </div>
            </div>

            <Gradebook
              students={students}
              grades={combinedGrades}
              attendanceRows={allAttendance}
              onSelectStudent={(id) => setOpenStudentId(id)}
            />
          </div>
        )}

        {/* TAB 5: STUDENT MONITORING & LEAGUE */}
        {activeTab === 'monitoring' && (
          <div className="mobile-tab-pane">
            <StudentMonitoringLeague
              students={students}
              grades={combinedGrades}
              submissions={submissions}
              allAttendance={allAttendance}
              homeworkPosts={homeworkPosts}
              onOpenStudent={(id) => setOpenStudentId(id)}
            />
          </div>
        )}

        {/* TAB 6: AI ASSISTANT & CLASS DATA CHAT */}
        {activeTab === 'ai' && (
          <div className="mobile-tab-pane">
            <div className="mobile-pane-header">
              <div>
                <h2 className="mobile-pane-title">دستیار هوشمند و تحلیل داده‌های کلاس</h2>
                <p className="mobile-pane-subtitle">گفتگو درباره عملکرد بچه‌ها، تحلیل تکالیف و طراحی آزمون</p>
              </div>
            </div>

            {/* Sub-tab segmented toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                className={`btn ${aiSubTab === 'chat' ? '' : 'secondary'}`}
                style={{
                  flex: 1,
                  fontSize: 13.5,
                  padding: '10px 12px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
                onClick={() => setAiSubTab('chat')}
              >
                <span>💬</span>
                <span>گفتگو و تحلیل داده‌های کلاس</span>
              </button>
              <button
                type="button"
                className={`btn ${aiSubTab === 'exam' ? '' : 'secondary'}`}
                style={{
                  flex: 1,
                  fontSize: 13.5,
                  padding: '10px 12px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
                onClick={() => setAiSubTab('exam')}
              >
                <span>📝</span>
                <span>آزمون‌ساز و کاربرگ هوشمند</span>
              </button>
            </div>

            {aiSubTab === 'chat' ? (
              <TeacherAiAssistant
                students={students}
                statsRows={statsRows}
                homeworkPosts={homeworkPosts}
                grades={combinedGrades}
                allAttendance={allAttendance}
                weakSubjects={weakSubjects}
              />
            ) : (
              <AiPracticeForm
                teacherPassword={teacherPassword}
                students={students}
                onDone={() => {
                  reload()
                  setActiveTab('posts')
                }}
                onCancel={() => setActiveTab('home')}
              />
            )}
          </div>
        )}
      </main>

      {/* Fixed Bottom Tab Navigation */}
      <MobileTabBar
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as TeacherTab)}
      />

      {/* MODAL: New Post */}
      <MobileModal
        isOpen={showNewPost}
        onClose={() => setShowNewPost(false)}
        title="ارسال پست یا تکلیف جدید"
        subtitle="برای نمایش به دانش‌آموزان در کلاس"
      >
        <NewPostForm
          teacherPassword={teacherPassword}
          onDone={() => {
            setShowNewPost(false)
            reload()
          }}
          onCancel={() => setShowNewPost(false)}
        />
      </MobileModal>

      {/* MODAL: New Student */}
      <MobileModal
        isOpen={showNewStudent}
        onClose={() => setShowNewStudent(false)}
        title="افزودن دانش‌آموز جدید"
        subtitle="ثبت مشخصات و کد ورود دانش‌آموز"
      >
        <NewStudentForm
          teacherPassword={teacherPassword}
          onDone={() => {
            setShowNewStudent(false)
            reload()
          }}
          onCancel={() => setShowNewStudent(false)}
        />
      </MobileModal>

      {/* MODAL: New Grade (Bulk or Single) */}
      <MobileModal
        isOpen={showNewGrade}
        onClose={() => setShowNewGrade(false)}
        title="ثبت نمرات کلاسی"
        subtitle="امتحانات، فعالیت کلاسی و تکالیف"
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            className={`btn ${gradeMode === 'bulk' ? '' : 'secondary'}`}
            style={{ fontSize: 14, padding: '8px 12px' }}
            onClick={() => setGradeMode('bulk')}
          >
            گروهی (همه کلاس)
          </button>
          <button
            type="button"
            className={`btn ${gradeMode === 'single' ? '' : 'secondary'}`}
            style={{ fontSize: 14, padding: '8px 12px' }}
            onClick={() => setGradeMode('single')}
          >
            انفرادی
          </button>
        </div>

        {gradeMode === 'bulk' ? (
          <BulkGradeForm
            teacherPassword={teacherPassword}
            students={students}
            onDone={() => {
              setShowNewGrade(false)
              reload()
            }}
            onCancel={() => setShowNewGrade(false)}
          />
        ) : (
          <NewGradeForm
            teacherPassword={teacherPassword}
            students={students}
            onDone={() => {
              setShowNewGrade(false)
              reload()
            }}
            onCancel={() => setShowNewGrade(false)}
          />
        )}
      </MobileModal>

      {/* MODAL: Student Profile / Details */}
      {openStudent && (
        <MobileModal
          isOpen={Boolean(openStudent)}
          onClose={() => setOpenStudentId(null)}
          title={`پرونده تحصیلی ${openStudent.full_name}`}
        >
          <StudentProfilePanel
            student={openStudent}
            grades={combinedGrades.filter((g) => g.student_id === openStudent.id)}
            submissions={submissions.filter((s) => s.student_id === openStudent.id)}
            attendanceRows={allAttendance.filter((a) => a.student_id === openStudent.id)}
            homeworkPosts={homeworkPosts}
            teacherPassword={teacherPassword}
            onClose={() => setOpenStudentId(null)}
            onChanged={reload}
            onDeleted={() => {
              setOpenStudentId(null)
              reload()
            }}
          />
        </MobileModal>
      )}

      {/* MODAL: Backup & Restore */}
      <MobileModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        title="پشتیبان‌گیری و بازیابی داده‌ها"
        subtitle="حفظ کلیه اطلاعات، تکالیف و نمرات کلاس"
      >
        <BackupRestoreModal
          teacherPassword={teacherPassword}
          onClose={() => setShowBackupModal(false)}
          onRestored={() => {
            reload()
            setShowBackupModal(false)
          }}
        />
      </MobileModal>
    </div>
  )
}
