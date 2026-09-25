import { useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { todayISO } from '../useJalaliDate'

export default function AttendanceList({
  students,
  attendanceToday,
  teacherPassword,
  onChanged,
}: {
  students: any[]
  attendanceToday: Record<string, string>
  teacherPassword: string
  onChanged: () => void
}) {
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const date = todayISO()

  async function setStatus(studentId: string, status: 'present' | 'late' | 'absent') {
    setBusyId(studentId)
    const current = attendanceToday[studentId]
    if (current === status) {
      // Toggle off if already selected
      await supabase.rpc('teacher_clear_attendance', {
        p_password: teacherPassword,
        p_student_id: studentId,
        p_date: date,
      })
    } else {
      await supabase.rpc('teacher_mark_attendance', {
        p_password: teacherPassword,
        p_student_id: studentId,
        p_date: date,
        p_status: status,
      })
    }
    setBusyId(null)
    onChanged()
  }

  async function markAllPresent() {
    setBusyId('all')
    for (const s of students) {
      await supabase.rpc('teacher_mark_attendance', {
        p_password: teacherPassword,
        p_student_id: s.id,
        p_date: date,
        p_status: 'present',
      })
    }
    setBusyId(null)
    onChanged()
  }

  const counts = useMemo(() => {
    let present = 0
    let late = 0
    let absent = 0
    let unmarked = 0
    for (const s of students) {
      const st = attendanceToday[s.id]
      if (st === 'present') present++
      else if (st === 'late') late++
      else if (st === 'absent') absent++
      else unmarked++
    }
    return { present, late, absent, unmarked }
  }, [students, attendanceToday])

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students
    return students.filter((s) =>
      s.full_name.toLowerCase().includes(search.trim().toLowerCase())
    )
  }, [students, search])

  return (
    <div className="mobile-card-section">
      {/* Top Banner & Quick Bulk Action */}
      <div className="mobile-action-bar">
        <button
          type="button"
          className="btn"
          style={{ width: '100%', fontSize: 16, padding: '12px 16px' }}
          onClick={markAllPresent}
          disabled={busyId === 'all'}
        >
          {busyId === 'all' ? 'در حال ثبت...' : '⚡ ثبت همه به عنوان حاضر'}
        </button>
      </div>

      {/* Counters Pill Strip */}
      <div className="mobile-stats-row">
        <div className="mobile-stat-chip green">
          <span className="count">{counts.present}</span>
          <span className="label">حاضر</span>
        </div>
        <div className="mobile-stat-chip yellow">
          <span className="count">{counts.late}</span>
          <span className="label">با تاخیر</span>
        </div>
        <div className="mobile-stat-chip red">
          <span className="count">{counts.absent}</span>
          <span className="label">غایب</span>
        </div>
        <div className="mobile-stat-chip gray">
          <span className="count">{counts.unmarked}</span>
          <span className="label">ثبت نشده</span>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ margin: '14px 0 10px' }}>
        <input
          type="text"
          className="mobile-search-input"
          placeholder="🔍 جستجوی نام دانش‌آموز..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Touch Attendance List */}
      <div className="mobile-attendance-list">
        {filteredStudents.length === 0 && (
          <div className="mobile-empty-state">
            دانش‌آموزی با این مشخصات یافت نشد.
          </div>
        )}

        {filteredStudents.map((s, idx) => {
          const status = attendanceToday[s.id]
          const isBusy = busyId === s.id || busyId === 'all'

          return (
            <div
              key={s.id}
              className={`mobile-att-item ${status ? `status-${status}` : ''}`}
            >
              <div className="mobile-att-info">
                <span className="mobile-att-index">{idx + 1}</span>
                <span className="mobile-att-name">{s.full_name}</span>
              </div>

              <div className="mobile-att-controls">
                <button
                  type="button"
                  disabled={isBusy}
                  className={`mobile-att-btn btn-present ${status === 'present' ? 'selected' : ''}`}
                  onClick={() => setStatus(s.id, 'present')}
                  title="حاضر"
                >
                  ✓ حاضر
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  className={`mobile-att-btn btn-late ${status === 'late' ? 'selected' : ''}`}
                  onClick={() => setStatus(s.id, 'late')}
                  title="تاخیر"
                >
                  ! تاخیر
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  className={`mobile-att-btn btn-absent ${status === 'absent' ? 'selected' : ''}`}
                  onClick={() => setStatus(s.id, 'absent')}
                  title="غایب"
                >
                  ✕ غایب
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
