export default function KpiCards({
  students,
  attendanceToday,
  homeworkPosts,
  submissions,
  grades,
  statsRows,
  weakSubjects,
}: {
  students: any[]
  attendanceToday: Record<string, string>
  homeworkPosts: any[]
  submissions: any[]
  grades: any[]
  statsRows: any[]
  weakSubjects: Array<{ subject: string; avg: number }>
}) {
  const total = students.length
  const presentToday = students.filter((s) => attendanceToday[s.id] === 'present').length
  const lateToday = students.filter((s) => attendanceToday[s.id] === 'late').length
  const unmarkedToday = Math.max(0, total - presentToday - lateToday)

  const pendingHomework = homeworkPosts.reduce((sum, p) => {
    const done = submissions.filter((s) => s.post_id === p.id).length
    return sum + Math.max(0, total - done)
  }, 0)

  const classAvg = grades.length
    ? grades.reduce((sum: number, g: any) => sum + (g.score / g.max_score) * 20, 0) / grades.length
    : null

  const ranked = [...statsRows].filter((r) => r.avg !== null).sort((a, b) => b.avg - a.avg)
  const best = ranked[0]
  const worst = ranked[ranked.length - 1]

  return (
    <div className="kpi-grid">
      {/* Total Students Card */}
      <div className="kpi-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            👥
          </div>
          <span className="badge-chip">کل کلاس</span>
        </div>
        <div className="kpi-val" style={{ marginTop: 10 }}>{total} <small style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>نفر</small></div>
        <div className="kpi-lbl">دانش‌آموزان پایه ششم</div>
      </div>

      {/* Attendance Today Card */}
      <div
        className="kpi-card"
        style={{ cursor: 'pointer' }}
        onClick={() => document.getElementById('att-section')?.scrollIntoView({ behavior: 'smooth' })}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            ✅
          </div>
          <span
            className="badge-chip"
            style={{
              background: lateToday > 0 ? 'var(--amber-light)' : 'var(--emerald-light)',
              color: lateToday > 0 ? 'var(--amber-text)' : 'var(--emerald-text)',
              borderColor: lateToday > 0 ? 'var(--amber-border)' : 'var(--emerald-border)',
            }}
          >
            {lateToday > 0 ? `${lateToday} تاخیر` : 'بدون تاخیر'}
          </span>
        </div>
        <div className="kpi-val" style={{ marginTop: 10 }}>
          {presentToday} <small style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>از {total} حاضر</small>
        </div>
        <div className="kpi-lbl">
          {unmarkedToday > 0 ? `${unmarkedToday} نفر نامشخص (لمس جهت ثبت)` : 'حضور و غیاب امروز کامل است'}
        </div>
      </div>

      {/* Pending Homework Card */}
      <div
        className="kpi-card"
        style={{ cursor: 'pointer' }}
        onClick={() => document.getElementById('hw-status-section')?.scrollIntoView({ behavior: 'smooth' })}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: '#FEF2F2',
              border: '1px solid #FECDD3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            ⏱️
          </div>
          <span
            className="badge-chip"
            style={{
              background: pendingHomework > 0 ? 'var(--rose-light)' : 'var(--bg-card-subtle)',
              color: pendingHomework > 0 ? 'var(--rose-text)' : 'var(--text-secondary)',
              borderColor: pendingHomework > 0 ? 'var(--rose-border)' : 'var(--border-subtle)',
            }}
          >
            تکالیف باقی‌مانده
          </span>
        </div>
        <div className="kpi-val" style={{ marginTop: 10 }}>{pendingHomework} <small style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>مورد</small></div>
        <div className="kpi-lbl">تکلیف بررسی یا تحویل‌نشده</div>
      </div>

      {/* Class Average Grade Card */}
      <div className="kpi-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: '#EEF2FF',
              border: '1px solid #C7D2FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            📈
          </div>
          <span className="badge-chip" style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'var(--primary-border)' }}>
            معدل کل
          </span>
        </div>
        <div className="kpi-val" style={{ marginTop: 10 }}>
          {classAvg !== null ? classAvg.toFixed(1) : '—'} <small style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>/ ۲۰</small>
        </div>
        <div className="kpi-lbl">میانگین کل ارزیابی‌های ثبت‌شده</div>
      </div>

      {/* Weak Subjects Banner */}
      {weakSubjects.length > 0 && (
        <div className="kpi-card wide" style={{ background: 'var(--amber-light)', borderColor: 'var(--amber-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🎯</span>
            <div style={{ margin: 0, fontWeight: 700, color: 'var(--amber-text)', fontSize: 13.5 }}>
              درس‌های نیازمند تمرین و تقویت بیشتر:
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {weakSubjects.map((w) => (
              <span
                key={w.subject}
                className="badge-chip"
                style={{ background: '#FFFFFF', color: 'var(--amber-text)', borderColor: 'var(--amber-border)' }}
              >
                {w.subject}: {w.avg.toFixed(1)} از ۲۰
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Best & Needs Attention Banner */}
      {best && worst && best.id !== worst.id && (
        <div className="kpi-card wide" style={{ background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🏆</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>پیشتاز کلاس: {best.name}</span>
              <span className="badge-chip" style={{ background: 'var(--emerald-light)', color: 'var(--emerald-text)', borderColor: 'var(--emerald-border)', fontSize: 12 }}>
                معدل {best.avg?.toFixed(1)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>💡</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>پشتیبانی ویژه: {worst.name}</span>
              <span className="badge-chip" style={{ background: 'var(--rose-light)', color: 'var(--rose-text)', borderColor: 'var(--rose-border)', fontSize: 12 }}>
                معدل {worst.avg?.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
