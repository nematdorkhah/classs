export default function GradesStrip({
  grades,
  students,
  limit = 8,
}: {
  grades: any[]
  students: any[]
  limit?: number
}) {
  return (
    <div className="grades">
      {grades.length === 0 && <div className="grade-card hard"><div className="name">هنوز نمره‌ای ثبت نشده</div></div>}
      {grades.slice(0, limit).map((g) => {
        const st = students.find((s) => s.id === g.student_id)
        return (
          <div className="grade-card hard" key={g.id}>
            <div className="name">{st ? st.full_name : '—'} ({g.subject}{g.skill ? ` — ${g.skill}` : ''})</div>
            <div className="score">
              {g.score}
              <small>/{g.max_score}</small>
            </div>
          </div>
        )
      })}
    </div>
  )
}
