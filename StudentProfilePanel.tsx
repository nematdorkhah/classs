import { useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { groupSkillMastery, computeStreak, computeBadges, getHomeworkStatus } from '../masteryHelpers'
import { getSignedFileUrl } from '../viewSubmission'
import FileViewerModal from './FileViewerModal'
import StudentReportCard from './StudentReportCard'

export default function StudentProfilePanel({
  student,
  grades,
  submissions,
  attendanceRows,
  homeworkPosts,
  teacherPassword,
  onClose,
  onChanged,
  onDeleted,
}: {
  student: any
  grades: any[]
  submissions: any[]
  attendanceRows: any[]
  homeworkPosts: any[]
  teacherPassword: string
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(student.full_name)
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null)
  const [scoreDraft, setScoreDraft] = useState('')
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [viewerName, setViewerName] = useState('')
  const [showReportCard, setShowReportCard] = useState(false)

  // Password / Access Code State
  const [editingCode, setEditingCode] = useState(false)
  const [codeDraft, setCodeDraft] = useState(student.access_code || '')
  const [showPassword, setShowPassword] = useState(false)

  // Teacher Note for Report Card
  const firstName = (student.full_name || '').trim().split(' ')[0] || 'دانش‌آموز'
  const savedReportNote = useMemo(() => {
    try {
      const raw = localStorage.getItem(`teacher_report_note_${student.id}`)
      if (raw) return JSON.parse(raw)
    } catch {
      // ignore
    }
    return {
      active: false,
      text: `سلام ${firstName} عزیز، تلاش و پشتکار شما در فعالیت‌های کلاسی ستودنی است. با تمرین و دقت بیشتر در حل مسائل، مطمئناً به موفقیت‌های بزرگ‌تری دست پیدا خواهی کرد.`,
    }
  }, [student.id, firstName])

  const [noteActive, setNoteActive] = useState(savedReportNote.active)
  const [noteText, setNoteText] = useState(savedReportNote.text)
  const [noteSavedNotice, setNoteSavedNotice] = useState(false)

  function saveTeacherReportNote() {
    localStorage.setItem(
      `teacher_report_note_${student.id}`,
      JSON.stringify({ active: noteActive, text: noteText.trim(), updatedAt: new Date().toISOString() })
    )
    setNoteSavedNotice(true)
    setTimeout(() => setNoteSavedNotice(false), 2500)
  }

  async function openFile(path: string) {
    if (!path || path === 'text_only') return
    const url = await getSignedFileUrl(path)
    if (!url) {
      alert('نمایش فایل ممکن نشد.')
      return
    }
    setViewerUrl(url)
    setViewerName(path.split('/').pop() || 'file')
  }

  async function saveCodeChange() {
    if (!codeDraft.trim()) {
      alert('کد عبور نمی‌تواند خالی باشد.')
      return
    }
    try {
      await supabase.rpc('student_change_code', {
        p_student_id: student.id,
        p_old_code: student.access_code,
        p_new_code: codeDraft.trim(),
      })
    } catch (e) {
      console.warn('Direct RPC code update note:', e)
    }
    student.access_code = codeDraft.trim()
    setEditingCode(false)
    alert('رمز ورود دانش‌آموز با موفقیت تغییر کرد.')
    onChanged()
  }

  const skillGroups = groupSkillMastery(grades)
  const streak = computeStreak(homeworkPosts, submissions)
  const badges = computeBadges(streak, grades, attendanceRows)

  const trendData = [...grades]
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((g, i) => ({ idx: i + 1, نمره: Number(((g.score / g.max_score) * 20).toFixed(1)) }))

  const presentCount = attendanceRows.filter((a) => a.status === 'present').length
  const lateCount = attendanceRows.filter((a) => a.status === 'late').length
  const attendanceRate = attendanceRows.length ? Math.round((presentCount / attendanceRows.length) * 100) : null

  const doneCount = submissions.length

  async function saveRename() {
    if (!nameDraft.trim()) return
    await supabase.rpc('teacher_update_student', { p_password: teacherPassword, p_student_id: student.id, p_full_name: nameDraft.trim() })
    setRenaming(false)
    onChanged()
  }

  async function deleteStudent() {
    if (!confirm(`مطمئنی می‌خوای ${student.full_name} رو کامل حذف کنی؟ همه‌ی نمره/حضور/تکلیفاش هم پاک می‌شه.`)) return
    await supabase.rpc('teacher_delete_student', { p_password: teacherPassword, p_student_id: student.id })
    onDeleted()
  }

  async function saveGradeEdit(gradeId: string, maxScore: number) {
    const val = parseFloat(scoreDraft)
    if (isNaN(val) || val < 0 || val > maxScore) {
      alert(`نمره باید بین ۰ تا ${maxScore} باشه.`)
      return
    }
    await supabase.rpc('teacher_update_grade', { p_password: teacherPassword, p_grade_id: gradeId, p_score: val, p_max_score: maxScore })
    setEditingGradeId(null)
    onChanged()
  }

  async function deleteGrade(gradeId: string) {
    if (!confirm('این نمره حذف بشه؟')) return
    await supabase.rpc('teacher_delete_grade', { p_password: teacherPassword, p_grade_id: gradeId })
    onChanged()
  }

  return (
    <>
      <section className="block">
        <div className="block-head">
          {renaming ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }} />
              <button className="btn" type="button" style={{ padding: '6px 14px', width: 'auto' }} onClick={saveRename}>ذخیره</button>
              <button className="link" onClick={() => setRenaming(false)}>انصراف</button>
            </div>
          ) : (
            <h2>پروفایل {student.full_name}</h2>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            {!renaming && <button className="link" onClick={() => setRenaming(true)}>✏️ ویرایش نام</button>}
            {!renaming && <button className="link" onClick={() => setShowReportCard(true)}>🖨 کارنامه</button>}
            <button className="link" style={{ color: 'var(--rose-text)' }} onClick={deleteStudent}>🗑 حذف</button>
            <button className="link" onClick={onClose}>بستن</button>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-val">{doneCount}/{homeworkPosts.length}</div>
            <div className="kpi-lbl">تکالیف ارسالی</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-val">{attendanceRate !== null ? `${attendanceRate}٪` : '—'}</div>
            <div className="kpi-lbl">نرخ حضور ({lateCount} تاخیر)</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-val">{streak}</div>
            <div className="kpi-lbl">پیوستگی فعلی</div>
          </div>
        </div>

        {/* STUDENT PASSWORD & ACCESS CODE MANAGEMENT */}
        <div
          className="form-panel hard"
          style={{
            marginTop: 16,
            padding: '14px 16px',
            background: '#F8FAFC',
            border: '2px solid #CBD5E1',
            borderRadius: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🔑</span>
              <div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>
                  رمز عبور دانش‌آموز (کد ملی / رمز ورود):
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  {editingCode ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={codeDraft}
                        onChange={(e) => setCodeDraft(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '2px solid var(--black)',
                          fontSize: 14,
                          fontWeight: 800,
                          width: 140,
                        }}
                      />
                      <button
                        type="button"
                        className="btn"
                        style={{ width: 'auto', padding: '6px 12px', fontSize: 12.5 }}
                        onClick={saveCodeChange}
                      >
                        ذخیره رمز
                      </button>
                      <button
                        type="button"
                        className="link"
                        onClick={() => {
                          setEditingCode(false)
                          setCodeDraft(student.access_code || '')
                        }}
                      >
                        انصراف
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 900,
                          letterSpacing: showPassword ? '1px' : '3px',
                          color: '#0F172A',
                          fontFamily: 'monospace',
                        }}
                      >
                        {showPassword ? student.access_code : '••••••••'}
                      </span>
                      <button
                        type="button"
                        className="link"
                        style={{ fontSize: 13 }}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? '🙈 مخفی' : '👁️ مشاهده'}
                      </button>
                      <button
                        type="button"
                        className="upload-btn"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => setEditingCode(true)}
                      >
                        ✏️ تغییر رمز
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TEACHER NOTE & RECOMMENDATION FOR REPORT CARD */}
        <div
          className="form-panel hard"
          style={{
            marginTop: 16,
            padding: '16px',
            background: noteActive ? '#FFFBEB' : '#F1F5F9',
            border: `2px solid ${noteActive ? '#F59E0B' : '#CBD5E1'}`,
            borderRadius: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 900, fontSize: 14, color: '#1E293B' }}>
              <input
                type="checkbox"
                checked={noteActive}
                onChange={(e) => setNoteActive(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <span>یادداشت و توصیه من برای دانش‌آموز (جهت درج در کارنامه)</span>
            </label>

            <span
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: noteActive ? '#B45309' : '#64748B',
                background: noteActive ? '#FEF3C7' : '#E2E8F0',
                padding: '3px 8px',
                borderRadius: 999,
              }}
            >
              {noteActive ? '✅ فعال و نمایش در کارنامه' : '🔒 غیرفعال (پیش‌فرض: ارسال نمی‌شود)'}
            </span>
          </div>

          <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#64748B' }}>
            در صورت فعال‌سازی، این توصیه فقط برای <strong>{firstName}</strong> در صفحه کارنامه و نسخه چاپی نمایش داده می‌شود.
          </p>

          <textarea
            rows={3}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            disabled={!noteActive}
            placeholder={`یادداشت و توصیه آموزگار برای ${firstName}...`}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 10,
              border: '2px solid #CBD5E1',
              fontSize: 13,
              fontFamily: 'inherit',
              lineHeight: 1.6,
              background: noteActive ? '#FFFFFF' : '#E2E8F0',
              opacity: noteActive ? 1 : 0.7,
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <button
              type="button"
              className="btn"
              style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}
              onClick={saveTeacherReportNote}
            >
              💾 ذخیره یادداشت کارنامه
            </button>
            {noteSavedNotice && (
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#10B981' }}>
                ✓ با موفقیت ذخیره شد
              </span>
            )}
          </div>
        </div>

        {badges.length > 0 && (
          <div className="badge-row">
            {badges.map((b) => (
              <span className="badge-chip" key={b}>{b}</span>
            ))}
          </div>
        )}

        {trendData.length >= 2 && (
          <div className="form-panel" style={{ height: 200, marginTop: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis dataKey="idx" fontSize={11} tickFormatter={(v) => `#${v}`} />
                <YAxis fontSize={11} domain={[0, 20]} />
                <Tooltip />
                <Line type="monotone" dataKey="نمره" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <div className="block-head"><h2 style={{ fontSize: 15 }}>نقشه مهارت‌ها (میانگین هر درس)</h2></div>
          <div className="board hard">
            {skillGroups.length === 0 && (
              <div className="post"><div className="body"><p>هنوز نمره‌ای ثبت نشده.</p></div></div>
            )}
            {skillGroups.map((sg) => (
              <div className="post" key={sg.subject}>
                <div className="tag">📚</div>
                <div className="body">
                  <h3>{sg.subject} — میانگین {sg.avg.toFixed(1)}</h3>
                  {sg.skills.length > 0 ? (
                    <p>
                      {sg.skills.map((sk) => (
                        <span key={sk.skill} style={{ display: 'inline-block', marginInlineEnd: 12 }}>
                          {sk.color} {sk.skill} ({sk.avg.toFixed(1)})
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p style={{ color: '#8a8378' }}>مهارت جزئی برای این درس ثبت نشده (فقط نمره کلی).</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {grades.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div className="block-head"><h2 style={{ fontSize: 15 }}>همه‌ی نمره‌ها (ویرایش/حذف)</h2></div>
            <div className="hw-list hard">
              {grades.map((g) => (
                <div className="hw-item" key={g.id}>
                  <div className="title">
                    <h4>{g.subject}{g.skill ? ` — ${g.skill}` : ''}</h4>
                    <span>{new Date(g.recorded_at).toLocaleDateString('fa-IR')}</span>
                  </div>
                  {editingGradeId === g.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="number" step="0.25" value={scoreDraft}
                        onChange={(e) => setScoreDraft(e.target.value)}
                        style={{ width: 70, padding: '5px 8px', borderRadius: 8, border: '2px solid var(--black)' }}
                      />
                      <span style={{ fontSize: 12.5 }}>/{g.max_score}</span>
                      <button className="upload-btn" type="button" onClick={() => saveGradeEdit(g.id, g.max_score)}>ذخیره</button>
                      <button className="link" onClick={() => setEditingGradeId(null)}>انصراف</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontWeight: 800 }}>{g.score}/{g.max_score}</span>
                      <button className="upload-btn" type="button" onClick={() => { setEditingGradeId(g.id); setScoreDraft(String(g.score)) }}>✏️</button>
                      <button className="upload-btn" type="button" onClick={() => deleteGrade(g.id)}>🗑</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {homeworkPosts.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div className="block-head"><h2 style={{ fontSize: 15 }}>تاریخچه تکالیف</h2></div>
            <div className="hw-list hard">
              {homeworkPosts.map((p) => {
                const sub = submissions.find((s) => s.post_id === p.id)
                const status = getHomeworkStatus(p, sub)
                return (
                  <div className="hw-item" key={p.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="title" style={{ flex: 1 }}>
                        <h4>{p.title}</h4>
                        {p.due_at && <span>مهلت: {new Date(p.due_at).toLocaleString('fa-IR')}</span>}
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 800 }}>{status.color} {status.label}</span>
                      {sub?.file_url && sub.file_url !== 'text_only' ? (
                        <button className="upload-btn" type="button" onClick={() => openFile(sub.file_url)}>
                          📎 مشاهده فایل
                        </button>
                      ) : sub?.file_url === 'text_only' ? (
                        <span style={{ fontSize: 12, color: '#059669', background: '#ECFDF5', padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}>
                          📝 پاسخ متنی
                        </span>
                      ) : null}
                    </div>
                    {sub?.note && (
                      <div style={{ fontSize: 13, background: 'var(--cream-2)', borderRadius: 8, padding: '8px 10px' }}>
                        💬 {sub.note}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
      {viewerUrl && <FileViewerModal url={viewerUrl} fileName={viewerName} onClose={() => setViewerUrl(null)} />}
      {showReportCard && (
        <StudentReportCard
          student={student}
          grades={grades}
          attendanceRows={attendanceRows}
          submissions={submissions}
          homeworkCount={homeworkPosts.length}
          reportNote={noteActive ? noteText : undefined}
          onClose={() => setShowReportCard(false)}
        />
      )}
    </>
  )
}
