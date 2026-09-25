import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from './supabaseClient'
import TeacherDashboard from './pages/TeacherDashboard'
import StudentDashboard from './pages/StudentDashboard'
import SchoolLogo from './components/SchoolLogo'
import { toPersianDigits } from './utils/persianNumbers'
import { sortByLastName } from './utils/persianSort'

const initialIsTeacher = new URLSearchParams(window.location.search).has('teacher')

function loadStoredStudent() {
  try {
    const raw = localStorage.getItem('student')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function App() {
  const [roleMode, setRoleMode] = useState<'student' | 'teacher'>(() =>
    initialIsTeacher ? 'teacher' : 'student'
  )
  const [teacherPassword, setTeacherPassword] = useState(
    () => sessionStorage.getItem('teacherPassword') || ''
  )
  const [teacherAuthed, setTeacherAuthed] = useState(
    () => sessionStorage.getItem('teacherAuthed') === '1'
  )
  const [student, setStudent] = useState(loadStoredStudent)
  const [students, setStudents] = useState<any[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [checking, setChecking] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (roleMode === 'teacher') return
    if (!student) {
      supabase.rpc('list_students_public').then(({ data }) => setStudents(data || []))
    }
  }, [student, roleMode])

  const sortedAllStudents = useMemo(() => {
    return sortByLastName(students, 'full_name')
  }, [students])

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return sortedAllStudents
    return sortedAllStudents.filter((s) =>
      s.full_name.toLowerCase().includes(studentSearch.trim().toLowerCase())
    )
  }, [sortedAllStudents, studentSearch])

  function persistStudent(s: any) {
    localStorage.setItem('student', JSON.stringify(s))
    setStudent(s)
  }

  function logoutStudent() {
    localStorage.removeItem('student')
    setStudent(null)
    setAccessCode('')
    setSelectedStudentId('')
  }

  function logoutTeacher() {
    sessionStorage.removeItem('teacherAuthed')
    sessionStorage.removeItem('teacherPassword')
    setTeacherAuthed(false)
    setTeacherPassword('')
    setPasswordInput('')
  }

  async function teacherLogin(e: React.FormEvent) {
    e.preventDefault()
    setChecking(true)
    setLoginError('')
    try {
      const { data, error } = await supabase.rpc('verify_teacher', { p_password: passwordInput })
      setChecking(false)
      if (error || !data) {
        setLoginError('رمز عبور وارد شده نادرست است.')
        return
      }
      sessionStorage.setItem('teacherAuthed', '1')
      sessionStorage.setItem('teacherPassword', passwordInput)
      setTeacherPassword(passwordInput)
      setTeacherAuthed(true)
    } catch {
      setChecking(false)
      setLoginError('خطا در برقراری ارتباط با پایگاه داده.')
    }
  }

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || null
  }, [students, selectedStudentId])

  async function studentLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStudentId) {
      setLoginError('لطفاً نام خود را از فهرست کشویی جستجوی دانش‌آموزان انتخاب فرمایید.')
      return
    }
    if (!accessCode.trim()) {
      setLoginError('لطفاً کد ورود (کد ملی) خود را وارد فرمایید.')
      return
    }
    setChecking(true)
    setLoginError('')
    try {
      const { data, error } = await supabase.rpc('student_login', {
        p_student_id: selectedStudentId,
        p_access_code: accessCode.trim(),
      })
      setChecking(false)
      if (error || !data) {
        setLoginError('کد ورود (کد ملی) صحیح نمی‌باشد.')
        return
      }
      persistStudent(data)
    } catch {
      setChecking(false)
      setLoginError('خطا در ورود دانش‌آموز.')
    }
  }

  // Teacher dashboard
  if (roleMode === 'teacher' && teacherAuthed) {
    return <TeacherDashboard teacherPassword={teacherPassword} onLogout={logoutTeacher} />
  }

  // Student dashboard
  if (student) {
    return (
      <StudentDashboard
        student={student}
        onLogout={logoutStudent}
        onStudentUpdate={persistStudent}
      />
    )
  }

  // Mobile App Native Login Screen
  return (
    <div className="mobile-login-wrapper">
      <div className="mobile-login-card">
        {/* Top App Identity */}
        <div className="mobile-login-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <SchoolLogo size={110} />
          </div>
          <span className="mobile-school-tag">دبستان حضرت قائم (عج)</span>
          <h1 className="mobile-login-title">
            کلاس ششم <span style={{ color: 'var(--primary)' }}>ابتدایی</span>
          </h1>
          <p className="mobile-login-subtitle">
            سامانه هوشمند تکالیف، نمرات و حضور و غیاب کلاسی
          </p>
        </div>

        {/* Role Segmented Selector */}
        <div className="mobile-role-selector">
          <button
            type="button"
            className={`mobile-role-btn ${roleMode === 'student' ? 'active' : ''}`}
            onClick={() => {
              setRoleMode('student')
              setLoginError('')
            }}
          >
            🧒 ورود دانش‌آموزان
          </button>
          <button
            type="button"
            className={`mobile-role-btn ${roleMode === 'teacher' ? 'active' : ''}`}
            onClick={() => {
              setRoleMode('teacher')
              setLoginError('')
            }}
          >
            👨‍🏫 ورود آموزگار
          </button>
        </div>

        {/* Login Forms */}
        {roleMode === 'student' ? (
          <form onSubmit={studentLogin} className="mobile-form">
            <label className="mobile-label">
              نام و نام خانوادگی دانش‌آموز (جستجوی الفبایی فامیلی):
            </label>
            <div ref={dropdownRef} style={{ position: 'relative', width: '100%', marginBottom: 6 }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="mobile-input search"
                  placeholder="🔍 نام یا نام خانوادگی خود را تایپ کنید..."
                  value={studentSearch}
                  onFocus={() => setShowSearchDropdown(true)}
                  onChange={(e) => {
                    setStudentSearch(e.target.value)
                    setShowSearchDropdown(true)
                    if (!e.target.value.trim()) {
                      setSelectedStudentId('')
                    }
                  }}
                  style={{
                    paddingLeft: studentSearch ? 36 : 14,
                    borderColor: selectedStudentId ? '#16A34A' : undefined,
                  }}
                />
                {studentSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setStudentSearch('')
                      setSelectedStudentId('')
                      setShowSearchDropdown(true)
                    }}
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: '#E2E8F0',
                      border: 'none',
                      borderRadius: '50%',
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: 12,
                      color: '#475569',
                    }}
                    title="پاک کردن"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Floating dropdown autocomplete */}
              {showSearchDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    left: 0,
                    zIndex: 50,
                    background: '#FFFFFF',
                    borderRadius: 12,
                    border: '2px solid var(--black)',
                    boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
                    maxHeight: 240,
                    overflowY: 'auto',
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      padding: '6px 12px',
                      background: '#F8FAFC',
                      borderBottom: '1px solid #E2E8F0',
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#64748B',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>فهرست الفبای فامیلی ({toPersianDigits(filteredStudents.length)} دانش‌آموز)</span>
                    <span>انتخاب با کلیک</span>
                  </div>

                  {filteredStudents.length === 0 ? (
                    <div style={{ padding: '12px 14px', fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                      دانش‌آموزی با این نام یافت نشد.
                    </div>
                  ) : (
                    filteredStudents.map((s, idx) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedStudentId(s.id)
                          setStudentSearch(s.full_name)
                          setShowSearchDropdown(false)
                          setLoginError('')
                        }}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          fontSize: 13.5,
                          fontWeight: selectedStudentId === s.id ? 900 : 600,
                          background: selectedStudentId === s.id ? '#EFF6FF' : 'transparent',
                          color: selectedStudentId === s.id ? '#1D4ED8' : '#0F172A',
                          borderBottom: '1px solid #F1F5F9',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (selectedStudentId !== s.id) {
                            e.currentTarget.style.background = '#F8FAFC'
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            selectedStudentId === s.id ? '#EFF6FF' : 'transparent'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#94A3B8', width: 20 }}>
                            {toPersianDigits(idx + 1)}.
                          </span>
                          <span>{s.full_name}</span>
                        </div>
                        {selectedStudentId === s.id ? (
                          <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 800 }}>✓ انتخاب شده</span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>انتخاب ◀</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected confirmation indicator */}
            {selectedStudent && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#F0FDF4',
                  border: '1.5px solid #86EFAC',
                  borderRadius: 10,
                  padding: '6px 12px',
                  marginBottom: 8,
                  fontSize: 12.5,
                  color: '#166534',
                  fontWeight: 700,
                }}
              >
                <span>✅ دانش‌آموز انتخاب‌شده: <strong>{selectedStudent.full_name}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudentId('')
                    setStudentSearch('')
                    setShowSearchDropdown(true)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#DC2626',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  تغییر انتخاب ✕
                </button>
              </div>
            )}

            <label className="mobile-label" style={{ marginTop: 12 }}>
              کد ورود (کد ملی یا رمز عبور)
            </label>
            <input
              type="password"
              className="mobile-input"
              placeholder="کد ملی خود را وارد فرمایید"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              inputMode="numeric"
            />

            {loginError && <div className="error-text">{loginError}</div>}

            <button
              className="btn"
              type="submit"
              disabled={checking}
              style={{ marginTop: 18, height: 48, fontSize: 17 }}
            >
              {checking ? 'در حال ورود...' : '🚀 ورود به برنامه'}
            </button>
          </form>
        ) : (
          <form onSubmit={teacherLogin} className="mobile-form">
            <label className="mobile-label">رمز عبور آموزگار</label>
            <input
              type="password"
              className="mobile-input"
              placeholder="رمز عبور مدیریت کلاس"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
            />

            {loginError && <div className="error-text">{loginError}</div>}

            <button
              className="btn"
              type="submit"
              disabled={checking}
              style={{ marginTop: 18, height: 48, fontSize: 17 }}
            >
              {checking ? 'در حال بررسی...' : '🔒 ورود به پنل آموزگار'}
            </button>
          </form>
        )}

        {/* Footer info */}
        <div className="mobile-login-footer" style={{ flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <span>سال تحصیلی {toPersianDigits('1404')} - {toPersianDigits('1405')}</span>
            <span>●</span>
            <span>پایه ششم ابتدایی</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 700, letterSpacing: '0.02em', direction: 'ltr' }}>
            Powered by Nemat Dorkha
          </div>
        </div>
      </div>
    </div>
  )
}
