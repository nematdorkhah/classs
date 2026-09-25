export default function ChallengeStrip({
  currentDay = 8,
  totalDays = 30,
  title = "چالش ۳۰ روزه یادگیری و انضباط فعال کلاس ششم",
  subtitle = "پایش روزبه‌روز حضور، تکالیف و فعالیت‌های مستمر کلاسی",
}: {
  currentDay?: number
  totalDays?: number
  title?: string
  subtitle?: string
}) {
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)

  return (
    <div className="streak-tracker-card hard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="streak-badge-pill">
            <span>روز {String(currentDay).padStart(2, '۰')}</span>
            <span style={{ opacity: 0.8, fontSize: 13 }}>از {totalDays}</span>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {title}
            </h4>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {subtitle}
            </p>
          </div>
        </div>

        <div className="status-tag-pill">
          <span className="status-dot"></span> در حال اجرا
        </div>
      </div>

      {/* Horizontal 30-Day Grid */}
      <div className="streak-chain" style={{ marginTop: 14 }}>
        {days.map((d) => {
          const isDone = d < currentDay
          const isToday = d === currentDay
          return (
            <div
              key={d}
              className={`streak-box ${isDone ? 'filled' : ''} ${isToday ? 'active' : ''}`}
              title={`روز ${d}`}
            >
              {isDone ? '✓' : d}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
        <span>روز ۰۱ (شروع)</span>
        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>امروز (روز {currentDay}) 🎯</span>
        <span>روز {totalDays} (پایان)</span>
      </div>
    </div>
  )
}
