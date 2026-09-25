import { useMemo, useState } from 'react'

const th: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'right',
  fontWeight: 700,
  fontSize: 13,
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)',
  background: 'var(--bg-card-subtle)',
}

const td: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  fontWeight: 500,
  fontSize: 13,
  borderBottom: '1px solid var(--border-subtle)',
}

export default function Gradebook({
  students,
  grades,
  attendanceRows,
  onSelectStudent,
}: {
  students: any[]
  grades: any[]
  attendanceRows: any[]
  onSelectStudent: (id: string) => void
}) {
  const [filterAtRisk, setFilterAtRisk] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  const subjects = useMemo(() => Array.from(new Set(grades.map((g) => g.subject))), [grades])

  const studentRows = useMemo(() => {
    return students.map((st) => {
      const stGrades = grades.filter((g) => g.student_id === st.id)
      const stAttendance = attendanceRows.filter((a) => a.student_id === st.id)

      const totalNormalized = stGrades.reduce((acc, g) => acc + (g.score / g.max_score) * 20, 0)
      const gpa = stGrades.length ? (totalNormalized / stGrades.length).toFixed(1) : null

      const sortedGrades = [...stGrades].sort(
        (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      )
      let isDropping = false
      if (sortedGrades.length >= 3) {
        const norm = (g: any) => (g.score / g.max_score) * 20
        const last = norm(sortedGrades[sortedGrades.length - 1])
        const prev = norm(sortedGrades[sortedGrades.length - 2])
        const beforePrev = norm(sortedGrades[sortedGrades.length - 3])
        if (last < prev && prev < beforePrev) isDropping = true
      }

      const absentCount = stAttendance.filter((a) => a.status === 'absent').length
      const atRisk = isDropping || (gpa !== null && Number(gpa) < 12) || absentCount >= 3

      return { ...st, gpa, atRisk, isDropping, absentCount, gradesBySubject: stGrades }
    })
  }, [students, grades, attendanceRows])

  const filtered = useMemo(() => {
    let list = studentRows
    if (filterAtRisk) {
      list = list.filter((s) => s.atRisk)
    }
    if (search.trim()) {
      list = list.filter((s) =>
        s.full_name.toLowerCase().includes(search.trim().toLowerCase())
      )
    }
    return list
  }, [studentRows, filterAtRisk, search])

  const atRiskCount = studentRows.filter((s) => s.atRisk).length

  return (
    <div className="mobile-gradebook">
      {/* Search & Mode Switcher Controls */}
      <div className="mobile-gradebook-header">
        <input
          type="text"
          className="mobile-search-input"
          placeholder="🔍 جستجوی دانش‌آموز..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="mobile-gradebook-toggles">
          <button
            type="button"
            className={`mobile-filter-chip ${filterAtRisk ? 'active' : ''}`}
            onClick={() => setFilterAtRisk(!filterAtRisk)}
          >
            {filterAtRisk ? '✓ فیلتر نیازمند توجه' : `⚠️ نیازمند توجه (${atRiskCount})`}
          </button>

          <button
            type="button"
            className="mobile-filter-chip"
            onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
          >
            {viewMode === 'cards' ? '📊 جدول کامل' : '🗂 نمای کارتی'}
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="mobile-empty-state">
          هیچ دانش‌آموزی با این مشخصات یافت نشد.
        </div>
      )}

      {/* Cards View (Default Mobile UX) */}
      {viewMode === 'cards' ? (
        <div className="mobile-student-cards-list">
          {filtered.map((st) => (
            <div
              key={st.id}
              className={`mobile-student-card ${st.atRisk ? 'at-risk' : ''}`}
              onClick={() => onSelectStudent(st.id)}
            >
              <div className="mobile-student-card-head">
                <div className="mobile-student-avatar">
                  {st.full_name.charAt(0)}
                </div>
                <div className="mobile-student-details">
                  <h4 className="mobile-student-name">{st.full_name}</h4>
                  <div className="mobile-student-status-text">
                    {st.atRisk ? (
                      <span className="text-red">
                        {st.isDropping ? '⚠️ افت نمره' : st.absentCount >= 3 ? '🔴 غیبت بالا' : '🟡 نمرات پایین'}
                      </span>
                    ) : (
                      <span className="text-green">🟢 وضعیت عادی</span>
                    )}
                  </div>
                </div>

                <div className="mobile-student-gpa-badge">
                  <span className="gpa-val">{st.gpa ?? '—'}</span>
                  <span className="gpa-lbl">معدل</span>
                </div>
              </div>

              {/* Subject Mini Chips */}
              <div className="mobile-student-subjects-strip">
                {subjects.slice(0, 4).map((sub) => {
                  const subGrades = st.gradesBySubject.filter((g: any) => g.subject === sub)
                  const subAvg = subGrades.length
                    ? (subGrades.reduce((a: number, b: any) => a + (b.score / b.max_score) * 20, 0) / subGrades.length).toFixed(1)
                    : null
                  return (
                    <div key={sub} className="mobile-mini-subject-chip">
                      <span className="sub-name">{sub}:</span>
                      <span className="sub-avg">{subAvg ?? '—'}</span>
                    </div>
                  )
                })}
              </div>

              <div className="mobile-student-card-footer">
                <span>تعداد نمرات: {st.gradesBySubject.length}</span>
                <span className="mobile-card-action">مشاهده پرونده و ویرایش نمره ←</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Wide Table View with Smooth Horizontal Scroll */
        <div className="form-panel hard" style={{ padding: 0, overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-secondary)' }}>
                <th style={th}>دانش‌آموز</th>
                {subjects.map((sub: string) => (
                  <th key={sub} style={th}>{sub}</th>
                ))}
                <th style={th}>معدل کل</th>
                <th style={th}>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((st) => (
                <tr
                  key={st.id}
                  onClick={() => onSelectStudent(st.id)}
                  style={{
                    borderTop: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: st.atRisk ? 'var(--rose-light)' : '#FFFFFF',
                  }}
                >
                  <td style={{ ...td, fontWeight: 700, color: 'var(--text-primary)' }}>{st.full_name}</td>
                  {subjects.map((sub: string) => {
                    const subGrades = st.gradesBySubject.filter((g: any) => g.subject === sub)
                    const subAvg = subGrades.length
                      ? (subGrades.reduce((a: number, b: any) => a + (b.score / b.max_score) * 20, 0) / subGrades.length).toFixed(1)
                      : '—'
                    return <td key={sub} style={td}>{subAvg}</td>
                  })}
                  <td style={{ ...td, fontWeight: 800, fontSize: 14, color: 'var(--primary)' }}>{st.gpa ?? '—'}</td>
                  <td style={td}>
                    {st.atRisk ? (
                      <span className="status-pill pending" style={{ background: 'var(--red)', color: 'var(--white)', fontSize: 11 }}>
                        {st.isDropping ? '⚠️ افت نمره' : st.absentCount >= 3 ? '🔴 غیبت بالا' : '🟡 میانگین ضعیف'}
                      </span>
                    ) : (
                      <span className="status-pill done" style={{ fontSize: 11 }}>
                        🟢 خوب
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
