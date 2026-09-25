import { useState, useMemo } from 'react'
import { getLocalExams, getLocalSubmissions, sanitizeExamTitle } from '../utils/examStore'

interface StudentMonitoringLeagueProps {
  students: any[]
  grades: any[]
  submissions: any[]
  allAttendance: any[]
  homeworkPosts: any[]
  onOpenStudent: (studentId: string) => void
}

export default function StudentMonitoringLeague({
  students,
  grades,
  submissions,
  allAttendance,
  homeworkPosts,
  onOpenStudent,
}: StudentMonitoringLeagueProps) {
  const [subTab, setSubTab] = useState<'league' | 'charts' | 'alerts'>('league')
  const [sortBy, setSortBy] = useState<'score' | 'avg' | 'submissions' | 'streak' | 'attendance'>('score')
  const [filterSubject, setFilterSubject] = useState<string>('all')
  const [selectedExamId, setSelectedExamId] = useState<string>('all')

  // Merge raw grades with exam submissions from local store to guarantee 100% sync
  const effectiveGrades = useMemo(() => {
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
          exam_id: exam.id,
        })
      }
    }
    return list
  }, [grades])

  const publishedExams = useMemo(() => getLocalExams(), [])

  // Calculate rich metrics for each student using effectiveGrades
  const studentMetrics = useMemo(() => {
    return students.map((s) => {
      const studentGrades = effectiveGrades.filter((g) => g.student_id === s.id)
      const avg = studentGrades.length
        ? studentGrades.reduce((sum, g) => sum + (g.score / g.max_score) * 20, 0) / studentGrades.length
        : null

      const studentSubs = submissions.filter((sub) => sub.student_id === s.id)
      const subCount = studentSubs.length
      const totalHomework = homeworkPosts.length
      const homeworkRate = totalHomework > 0 ? Math.round((subCount / totalHomework) * 100) : 100

      const studentAtt = allAttendance.filter((a) => a.student_id === s.id)
      const presentCount = studentAtt.filter((a) => a.status === 'present').length
      const lateCount = studentAtt.filter((a) => a.status === 'late').length
      const absentCount = studentAtt.filter((a) => a.status === 'absent').length
      const totalAttSessions = studentAtt.length
      const attendanceRate = totalAttSessions > 0
        ? Math.round(((presentCount + lateCount * 0.5) / totalAttSessions) * 100)
        : 100

      // Compute streak (consecutive submissions of recent homework)
      let streak = 0
      const sortedHw = [...homeworkPosts].sort(
        (a, b) => new Date(b.publish_at).getTime() - new Date(a.publish_at).getTime()
      )
      for (const hw of sortedHw) {
        const hasSub = studentSubs.some((sub) => sub.post_id === hw.id)
        if (hasSub) streak++
        else break
      }

      // Compute Overall League Points (0 to 1000+ XP scale)
      // Factors: Grade average (weight: 40%), Homework rate (weight: 30%), Attendance (weight: 20%), Streak bonus (weight: 10%)
      const gradePart = avg !== null ? (avg / 20) * 400 : 250
      const hwPart = (homeworkRate / 100) * 300
      const attPart = (attendanceRate / 100) * 200
      const streakBonus = Math.min(100, streak * 20)
      const totalPoints = Math.round(gradePart + hwPart + attPart + streakBonus)

      // Qualitative status
      let level: 'خیلی خوب' | 'خوب' | 'قابل قبول' | 'نیازمند تلاش' = 'خیلی خوب'
      if (avg !== null) {
        if (avg >= 18) level = 'خیلی خوب'
        else if (avg >= 15) level = 'خوب'
        else if (avg >= 12) level = 'قابل قبول'
        else level = 'نیازمند تلاش'
      }

      // Needs attention flag
      const needsAttention = (avg !== null && avg < 14) || absentCount >= 2 || (totalHomework > 2 && homeworkRate < 50)

      return {
        id: s.id,
        name: s.full_name,
        accessCode: s.access_code,
        avg,
        gradesCount: studentGrades.length,
        subCount,
        totalHomework,
        homeworkRate,
        presentCount,
        lateCount,
        absentCount,
        attendanceRate,
        streak,
        totalPoints,
        level,
        needsAttention,
      }
    })
  }, [students, grades, submissions, allAttendance, homeworkPosts])

  // Sorted list for Leaderboard
  const sortedStudents = useMemo(() => {
    return [...studentMetrics].sort((a, b) => {
      if (sortBy === 'score') return b.totalPoints - a.totalPoints
      if (sortBy === 'avg') return (b.avg ?? 0) - (a.avg ?? 0)
      if (sortBy === 'submissions') return b.subCount - a.subCount
      if (sortBy === 'streak') return b.streak - a.streak
      if (sortBy === 'attendance') return b.attendanceRate - a.attendanceRate
      return 0
    })
  }, [studentMetrics, sortBy])

  // Subject breakdown for charts using effectiveGrades
  const subjectsData = useMemo(() => {
    const map: Record<string, { total: number; count: number; grades: number[] }> = {}
    for (const g of effectiveGrades) {
      const sub = g.subject || 'عمومی'
      if (!map[sub]) map[sub] = { total: 0, count: 0, grades: [] }
      const normalizedScore = (g.score / g.max_score) * 20
      map[sub].total += normalizedScore
      map[sub].count += 1
      map[sub].grades.push(normalizedScore)
    }
    return Object.entries(map).map(([subject, data]) => ({
      subject,
      avg: Number((data.total / data.count).toFixed(1)),
      count: data.count,
    })).sort((a, b) => b.avg - a.avg)
  }, [effectiveGrades])

  // Qualitative distribution count
  const levelDistribution = useMemo(() => {
    const dist = {
      'خیلی خوب': 0,
      'خوب': 0,
      'قابل قبول': 0,
      'نیازمند تلاش': 0,
    }
    for (const s of studentMetrics) {
      dist[s.level]++
    }
    return dist
  }, [studentMetrics])

  // Class overall averages
  const classAvg = useMemo(() => {
    const valid = studentMetrics.filter((s) => s.avg !== null)
    if (!valid.length) return null
    const sum = valid.reduce((acc, s) => acc + (s.avg || 0), 0)
    return Number((sum / valid.length).toFixed(1))
  }, [studentMetrics])

  const classHomeworkRate = useMemo(() => {
    if (!studentMetrics.length) return 0
    const sum = studentMetrics.reduce((acc, s) => acc + s.homeworkRate, 0)
    return Math.round(sum / studentMetrics.length)
  }, [studentMetrics])

  const classAttendanceRate = useMemo(() => {
    if (!studentMetrics.length) return 0
    const sum = studentMetrics.reduce((acc, s) => acc + s.attendanceRate, 0)
    return Math.round(sum / studentMetrics.length)
  }, [studentMetrics])

  const atRiskStudents = studentMetrics.filter((s) => s.needsAttention)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header Card */}
      <div
        className="mobile-card hard"
        style={{
          padding: '18px 20px',
          borderRadius: 18,
          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          color: '#FFFFFF',
          border: '2px solid var(--black)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>📈</span>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: '#F8FAFC' }}>
                سامانه پایش و رصد جامع کلاسی
              </h2>
            </div>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 0 0' }}>
              تحلیل عملکرد تحصیلی، رتبه‌بندی لیگ کلاسی، نمودارهای مقایسه‌ای و پایش وضعیت {students.length} دانش‌آموز
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <span
              style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                color: '#60A5FA',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              {classAvg !== null ? `میانگین کلاس: ${classAvg}` : 'بدون نمره'}
            </span>
            <span
              style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                color: '#34D399',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              تحویل تکالیف: {classHomeworkRate}٪
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginTop: 18,
            background: 'rgba(255,255,255,0.06)',
            padding: 4,
            borderRadius: 12,
          }}
        >
          <button
            type="button"
            onClick={() => setSubTab('league')}
            style={{
              padding: '10px 8px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              border: 'none',
              background: subTab === 'league' ? '#FFFFFF' : 'transparent',
              color: subTab === 'league' ? '#0F172A' : '#94A3B8',
              boxShadow: subTab === 'league' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>🏆</span>
            <span>لیگ کلاسی</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('charts')}
            style={{
              padding: '10px 8px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              border: 'none',
              background: subTab === 'charts' ? '#FFFFFF' : 'transparent',
              color: subTab === 'charts' ? '#0F172A' : '#94A3B8',
              boxShadow: subTab === 'charts' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>📊</span>
            <span>نمودارها و تحلیل</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('alerts')}
            style={{
              padding: '10px 8px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              border: 'none',
              background: subTab === 'alerts' ? '#FFFFFF' : 'transparent',
              color: subTab === 'alerts' ? '#0F172A' : '#94A3B8',
              boxShadow: subTab === 'alerts' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>⚠️</span>
            <span>نیازمند توجه ({atRiskStudents.length})</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          VIEW 1: LEAGUE & LEADERBOARD (لیگ کلاسی)
          ========================================================= */}
      {subTab === 'league' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Top 3 Podium */}
          {sortedStudents.length >= 3 && (
            <div
              className="mobile-card hard"
              style={{
                padding: '16px 12px 14px',
                borderRadius: 16,
                background: '#FFFFFF',
                border: '2px solid var(--black)',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#64748B' }}>
                  🌟 سکوی افتخار و پیشتازان کلاس ششم 🌟
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, alignItems: 'flex-end' }}>
                {/* 2nd Place */}
                <div
                  onClick={() => onOpenStudent(sortedStudents[1].id)}
                  style={{
                    background: '#F8FAFC',
                    border: '2px solid #CBD5E1',
                    borderRadius: 14,
                    padding: '12px 8px 8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 26 }}>🥈</div>
                  <div style={{ fontWeight: 900, fontSize: 13, color: '#0F172A', marginTop: 4 }}>
                    {sortedStudents[1].name}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 800, marginTop: 2 }}>
                    {sortedStudents[1].totalPoints} امتیاز
                  </div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                    تکالیف: {sortedStudents[1].subCount} | معدل: {sortedStudents[1].avg?.toFixed(1) ?? '—'}
                  </div>
                </div>

                {/* 1st Place */}
                <div
                  onClick={() => onOpenStudent(sortedStudents[0].id)}
                  style={{
                    background: 'linear-gradient(180deg, #FEF9C3 0%, #FEF08A 100%)',
                    border: '2px solid #EAB308',
                    borderRadius: 16,
                    padding: '16px 8px 10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 6px 16px rgba(234, 179, 8, 0.25)',
                    transform: 'translateY(-6px)',
                  }}
                >
                  <div style={{ fontSize: 32 }}>👑 🥇</div>
                  <div style={{ fontWeight: 900, fontSize: 14, color: '#854D0E', marginTop: 4 }}>
                    {sortedStudents[0].name}
                  </div>
                  <div style={{ fontSize: 12, color: '#A16207', fontWeight: 900, marginTop: 2 }}>
                    {sortedStudents[0].totalPoints} امتیاز
                  </div>
                  <div style={{ fontSize: 10.5, color: '#713F12', marginTop: 2 }}>
                    تکالیف: {sortedStudents[0].subCount} | معدل: {sortedStudents[0].avg?.toFixed(1) ?? '—'}
                  </div>
                </div>

                {/* 3rd Place */}
                <div
                  onClick={() => onOpenStudent(sortedStudents[2].id)}
                  style={{
                    background: '#FFF7ED',
                    border: '2px solid #FDBA74',
                    borderRadius: 14,
                    padding: '12px 8px 8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 26 }}>🥉</div>
                  <div style={{ fontWeight: 900, fontSize: 13, color: '#0F172A', marginTop: 4 }}>
                    {sortedStudents[2].name}
                  </div>
                  <div style={{ fontSize: 11, color: '#9A3412', fontWeight: 800, marginTop: 2 }}>
                    {sortedStudents[2].totalPoints} امتیاز
                  </div>
                  <div style={{ fontSize: 10, color: '#7C2D12', marginTop: 2 }}>
                    تکالیف: {sortedStudents[2].subCount} | معدل: {sortedStudents[2].avg?.toFixed(1) ?? '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sorting Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflowX: 'auto',
              paddingBottom: 4,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', whiteSpace: 'nowrap' }}>
              مرتب‌سازی براساس:
            </span>
            {[
              { id: 'score', label: '🏆 امتیاز کل لیگ' },
              { id: 'avg', label: '📊 میانگین نمرات' },
              { id: 'submissions', label: '📝 بیشترین تحویل تکلیف' },
              { id: 'streak', label: '🔥 روزهای پیوستگی' },
              { id: 'attendance', label: '✅ انضباط و حضور' },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setSortBy(btn.id as any)}
                style={{
                  padding: '6px 11px',
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  background: sortBy === btn.id ? '#2563EB' : '#FFFFFF',
                  color: sortBy === btn.id ? '#FFFFFF' : '#334155',
                  border: '1px solid #CBD5E1',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Full Students League Table / List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedStudents.map((s, idx) => {
              const rank = idx + 1
              return (
                <div
                  key={s.id}
                  onClick={() => onOpenStudent(s.id)}
                  className="mobile-card hard"
                  style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: '#FFFFFF',
                    border: '2px solid var(--black)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'transform 0.1s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background:
                          rank === 1 ? '#FEF08A' : rank === 2 ? '#E2E8F0' : rank === 3 ? '#FFEDD5' : '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: rank <= 3 ? 15 : 13,
                        color: '#0F172A',
                      }}
                    >
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 900, fontSize: 14, color: '#0F172A' }}>
                          {s.name}
                        </span>
                        {s.streak >= 3 && (
                          <span style={{ fontSize: 11, background: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: 999, fontWeight: 800 }}>
                            🔥 {s.streak} روز
                          </span>
                        )}
                        {s.needsAttention && (
                          <span style={{ fontSize: 10.5, background: '#FEE2E2', color: '#991B1B', padding: '1px 6px', borderRadius: 999, fontWeight: 800 }}>
                            ⚠️ نیاز به توجه
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, fontSize: 11.5, color: '#64748B', marginTop: 3 }}>
                        <span>تکالیف: <strong>{s.subCount}</strong> از {s.totalHomework} ({s.homeworkRate}٪)</span>
                        <span>•</span>
                        <span>معدل: <strong>{s.avg?.toFixed(1) ?? 'ثبت نشده'}</strong></span>
                        <span>•</span>
                        <span>حضور: <strong>{s.attendanceRate}٪</strong></span>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: '#2563EB' }}>
                      {s.totalPoints}
                    </span>
                    <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 800 }}>
                      امتیاز لیگ
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* =========================================================
          VIEW 2: VISUAL CHARTS & ANALYTICS (نمودارها و تحلیل کلاسی)
          ========================================================= */}
      {subTab === 'charts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Chart 1: Grade Comparison Bar Chart */}
          <div
            className="mobile-card hard"
            style={{
              padding: 16,
              borderRadius: 16,
              background: '#FFFFFF',
              border: '2px solid var(--black)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 900, margin: 0, color: '#0F172A' }}>
                  📊 نمودار مقایسه‌ای نمرات دانش‌آموزان
                </h4>
                <p style={{ fontSize: 11.5, color: '#64748B', margin: '2px 0 0 0' }}>
                  {selectedExamId === 'all'
                    ? 'میانگین نمرات ثبت‌شده برای هر دانش‌آموز (شامل تمامی تکالیف، آزمون‌ها و آزمونک‌ها)'
                    : `نمرات اخذشده در آزمون: ${sanitizeExamTitle(publishedExams.find(e => e.id === selectedExamId)?.title || '', '')}`}
                </p>
              </div>

              {/* Exam / Assessment Filter */}
              {publishedExams.length > 0 && (
                <div>
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '5px 10px',
                      borderRadius: 10,
                      border: '1.5px solid #CBD5E1',
                      background: '#F8FAFC',
                      color: '#1E293B',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all">🌟 میانگین کل نمرات و آزمون‌ها</option>
                    {publishedExams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        📝 {ex.subject}: {sanitizeExamTitle(ex.title, ex.subject)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {sortedStudents.map((s) => {
                let score = s.avg ?? 0
                let maxScore = 20
                let hasTaken = s.avg !== null
                let displayScore = s.avg !== null ? s.avg.toFixed(1) : '—'

                if (selectedExamId !== 'all') {
                  const exam = publishedExams.find(e => e.id === selectedExamId)
                  maxScore = exam?.totalPoints || 20
                  const examSubs = getLocalSubmissions().filter(sub => sub.examId === selectedExamId && sub.studentId === s.id)
                  if (examSubs.length > 0) {
                    const sub = examSubs[0]
                    const rawScore = sub.teacherGrading?.totalScore ?? sub.aiGrading?.totalScore ?? (sub as any).studentScore
                    if (rawScore !== undefined && rawScore !== null) {
                      score = Number(rawScore)
                      hasTaken = true
                      displayScore = `${score} از ${maxScore}`
                    } else {
                      hasTaken = false
                      displayScore = 'در حال تصحیح'
                    }
                  } else {
                    hasTaken = false
                    score = 0
                    displayScore = 'شرکت نکرده'
                  }
                }

                const normalized = (score / maxScore) * 20
                const percent = Math.min(100, Math.round((score / maxScore) * 100))
                const barColor = !hasTaken
                  ? '#CBD5E1'
                  : normalized >= 17
                  ? '#10B981'
                  : normalized >= 14
                  ? '#3B82F6'
                  : normalized >= 10
                  ? '#F59E0B'
                  : '#EF4444'

                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      onClick={() => onOpenStudent(s.id)}
                      style={{
                        width: 95,
                        fontSize: 12,
                        fontWeight: 800,
                        color: '#1E293B',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        textAlign: 'right',
                      }}
                      title={s.name}
                    >
                      {s.name}
                    </span>

                    <div
                      style={{
                        flex: 1,
                        background: '#F1F5F9',
                        height: 18,
                        borderRadius: 6,
                        overflow: 'hidden',
                        position: 'relative',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div
                        style={{
                          width: `${percent}%`,
                          height: '100%',
                          background: barColor,
                          borderRadius: 5,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>

                    <span
                      style={{
                        width: selectedExamId === 'all' ? 48 : 70,
                        fontSize: 11.5,
                        fontWeight: 900,
                        color: hasTaken ? barColor : '#94A3B8',
                        textAlign: 'left',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {displayScore}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Chart 2: Subject Averages Chart */}
          <div
            className="mobile-card hard"
            style={{
              padding: 16,
              borderRadius: 16,
              background: '#FFFFFF',
              border: '2px solid var(--black)',
            }}
          >
            <h4 style={{ fontSize: 15, fontWeight: 900, margin: '0 0 4px 0', color: '#0F172A' }}>
              📚 میانگین کلاسی به تفکیک درس‌ها
            </h4>
            <p style={{ fontSize: 11.5, color: '#64748B', margin: '0 0 12px 0' }}>
              بررسی نقاط قوت و نیاز به تقویت در دروس مختلف پایه ششم
            </p>

            {subjectsData.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {subjectsData.map((sub) => {
                  const pct = Math.min(100, Math.round((sub.avg / 20) * 100))
                  const color =
                    sub.avg >= 17 ? '#10B981' : sub.avg >= 14 ? '#3B82F6' : '#EF4444'

                  return (
                    <div key={sub.subject}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>
                        <span style={{ color: '#0F172A' }}>{sub.subject}</span>
                        <span style={{ color }}>{sub.avg} از ۲۰ ({sub.count} نمره ثبت‌شده)</span>
                      </div>
                      <div style={{ height: 10, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px', color: '#94A3B8', fontSize: 13 }}>
                هنوز نمره‌ای برای تحلیل دروس ثبت نشده است.
              </div>
            )}
          </div>

          {/* Chart 3: Level Distribution Grid */}
          <div
            className="mobile-card hard"
            style={{
              padding: 16,
              borderRadius: 16,
              background: '#FFFFFF',
              border: '2px solid var(--black)',
            }}
          >
            <h4 style={{ fontSize: 15, fontWeight: 900, margin: '0 0 12px 0', color: '#0F172A' }}>
              🎯 توزیع کیفی دانش‌آموزان کلاس
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#065F46' }}>🌟 خیلی خوب (۱۸-۲۰)</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#047857', marginTop: 4 }}>
                  {levelDistribution['خیلی خوب']} نفر
                </div>
                <div style={{ fontSize: 11, color: '#065F46', opacity: 0.8 }}>
                  {students.length > 0 ? Math.round((levelDistribution['خیلی خوب'] / students.length) * 100) : 0}٪ کل کلاس
                </div>
              </div>

              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#1E40AF' }}>👍 خوب (۱۵-۱۷.۹)</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1D4ED8', marginTop: 4 }}>
                  {levelDistribution['خوب']} نفر
                </div>
                <div style={{ fontSize: 11, color: '#1E40AF', opacity: 0.8 }}>
                  {students.length > 0 ? Math.round((levelDistribution['خوب'] / students.length) * 100) : 0}٪ کل کلاس
                </div>
              </div>

              <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#92400E' }}>⚠️ قابل قبول (۱۲-۱۴.۹)</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#B45309', marginTop: 4 }}>
                  {levelDistribution['قابل قبول']} نفر
                </div>
                <div style={{ fontSize: 11, color: '#92400E', opacity: 0.8 }}>
                  {students.length > 0 ? Math.round((levelDistribution['قابل قبول'] / students.length) * 100) : 0}٪ کل کلاس
                </div>
              </div>

              <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#991B1B' }}>🚨 نیازمند تلاش (زیر ۱۲)</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#B91C1C', marginTop: 4 }}>
                  {levelDistribution['نیازمند تلاش']} نفر
                </div>
                <div style={{ fontSize: 11, color: '#991B1B', opacity: 0.8 }}>
                  {students.length > 0 ? Math.round((levelDistribution['نیازمند تلاش'] / students.length) * 100) : 0}٪ کل کلاس
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          VIEW 3: AT RISK / STUDENTS NEEDING ATTENTION (نیازمند توجه)
          ========================================================= */}
      {subTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            className="mobile-card hard"
            style={{
              padding: 16,
              borderRadius: 16,
              background: '#FFFBEB',
              border: '2px solid #F59E0B',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 900, margin: 0, color: '#92400E' }}>
                  دیده‌بان پایش: دانش‌آموزان با افت تحصیلی یا غیبت
                </h4>
                <p style={{ fontSize: 12, color: '#B45309', margin: '2px 0 0 0' }}>
                  معیارها: میانگین نمره کمتر از ۱۴، بیش از ۲ جلسه غیبت، یا عدم ارسال بیش از ۵۰٪ تکالیف
                </p>
              </div>
            </div>
          </div>

          {atRiskStudents.length > 0 ? (
            atRiskStudents.map((s) => (
              <div
                key={s.id}
                onClick={() => onOpenStudent(s.id)}
                className="mobile-card hard"
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: '#FFFFFF',
                  border: '2px solid var(--black)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 900, margin: 0, color: '#0F172A' }}>
                      {s.name}
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {s.avg !== null && s.avg < 14 && (
                        <span style={{ fontSize: 11, background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 999, fontWeight: 800 }}>
                          افت میانگین نمرات: {s.avg.toFixed(1)}
                        </span>
                      )}
                      {s.absentCount >= 2 && (
                        <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 999, fontWeight: 800 }}>
                          {s.absentCount} جلسه غیبت ثبت‌شده
                        </span>
                      )}
                      {s.totalHomework > 2 && s.homeworkRate < 50 && (
                        <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1E40AF', padding: '2px 8px', borderRadius: 999, fontWeight: 800 }}>
                          تنها {s.subCount} تکلیف از {s.totalHomework} تحویل داده
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 12, padding: '6px 12px' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenStudent(s.id)
                    }}
                  >
                    بررسی پرونده
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div
              className="mobile-card hard"
              style={{
                padding: 24,
                textAlign: 'center',
                background: '#ECFDF5',
                border: '2px solid #10B981',
                borderRadius: 16,
              }}
            >
              <span style={{ fontSize: 36 }}>🎉</span>
              <h4 style={{ fontSize: 16, fontWeight: 900, color: '#065F46', margin: '8px 0 4px 0' }}>
                هیچ دانش‌آموزی در وضعیت بحرانی نیست!
              </h4>
              <p style={{ fontSize: 12.5, color: '#047857', margin: 0 }}>
                تمامی دانش‌آموزان در مسیر مشارکت مطلوب و نمرات مناسب قرار دارند.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
