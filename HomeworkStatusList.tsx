import { useState, useMemo, useEffect, useCallback } from 'react'
import { toPersianDigits } from '../utils/persianNumbers'
import { getLocalExams, getLocalSubmissions } from '../utils/examStore'
import { sortByLastName } from '../utils/persianSort'
import { supabase } from '../supabaseClient'
import AttachmentViewerModal from './AttachmentViewerModal'

export default function HomeworkStatusList({
  homeworkPosts,
  submissions,
  students,
  onRefresh,
}: {
  homeworkPosts: any[]
  submissions: any[]
  students: any[]
  onRefresh?: () => void
}) {
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null)
  const [filterModeMap, setFilterModeMap] = useState<Record<string, 'all' | 'submitted' | 'missing'>>({})
  const [serverExamSubs, setServerExamSubs] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [viewingAttachment, setViewingAttachment] = useState<{ url: string; title: string } | null>(null)

  // Fetch online exam/assignment submissions from server
  const fetchServerExamSubs = useCallback(async () => {
    try {
      const res = await fetch('/api/exams/submissions')
      const data = await res.json()
      if (data.success && Array.isArray(data.submissions)) {
        setServerExamSubs(data.submissions)
      }
    } catch (err) {
      console.warn('Failed to load server exam submissions', err)
    }
  }, [])

  useEffect(() => {
    fetchServerExamSubs()
  }, [fetchServerExamSubs])

  const handleRefresh = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setRefreshing(true)
    try {
      await fetchServerExamSubs()
      if (onRefresh) {
        onRefresh()
      }
    } finally {
      setTimeout(() => setRefreshing(false), 500)
    }
  }

  // Load interactive online assignments from local store
  const localAssignments = useMemo(() => {
    try {
      const allExams = getLocalExams()
      return allExams.filter((e) => e.mode === 'assignment')
    } catch {
      return []
    }
  }, [])

  const examSubmissions = useMemo(() => {
    const local = getLocalSubmissions()
    const map = new Map<string, any>()
    local.forEach((s) => map.set(s.id, s))
    serverExamSubs.forEach((s) => map.set(s.id, s))
    return Array.from(map.values())
  }, [serverExamSubs])

  // Combine standard homework and interactive assignments
  const allAssignments = useMemo(() => {
    const list: any[] = [
      ...homeworkPosts.map((hp) => ({
        id: hp.id,
        title: hp.title,
        due_at: hp.due_at,
        created_at: hp.publish_at || hp.created_at,
        isOnlineExam: false,
        raw: hp,
      })),
      ...localAssignments.map((la) => ({
        id: la.id,
        title: `[تکلیف آنلاین] ${la.title}`,
        due_at: la.dueDate,
        created_at: la.createdAt || la.scheduledStartTime,
        isOnlineExam: true,
        raw: la,
      })),
    ]

    // Sort newest first
    return list.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
      return dateB - dateA
    })
  }, [homeworkPosts, localAssignments])

  // Sort students alphabetically by family name (نام خانوادگی)
  const sortedStudents = useMemo(() => {
    return sortByLastName(students, 'full_name')
  }, [students])

  // Calculate status per student for a given assignment
  const getAssignmentStatuses = useCallback(
    (assignment: any) => {
      return sortedStudents.map((s) => {
        if (assignment.isOnlineExam) {
          const sub = examSubmissions.find(
            (es) => String(es.examId) === String(assignment.id) && String(es.studentId) === String(s.id)
          )
          const isSubmitted = Boolean(sub)
          const score = sub?.teacherGrading?.totalScore ?? sub?.aiGrading?.totalScore ?? (sub as any)?.studentScore
          return {
            student: s,
            isSubmitted,
            submittedAt: sub?.submittedAt,
            note: sub
              ? `پاسخ ثبت‌شده به تکلیف آنلاین${score !== undefined ? ` (نمره: ${toPersianDigits(score)} از ۲۰)` : ''}`
              : null,
            fileUrl: null,
          }
        } else {
          const sub = submissions.find(
            (item: any) =>
              String(item.post_id || item.postId) === String(assignment.id) &&
              String(item.student_id || item.studentId) === String(s.id)
          )
          const isSubmitted = Boolean(sub)
          let resolvedFileUrl: string | null = null
          if (sub?.file_url && sub.file_url !== 'text_only') {
            if (sub.file_url.startsWith('http') || sub.file_url.startsWith('data:')) {
              resolvedFileUrl = sub.file_url
            } else {
              try {
                const { data } = supabase.storage.from('submissions').getPublicUrl(sub.file_url)
                resolvedFileUrl = data?.publicUrl || sub.file_url
              } catch {
                resolvedFileUrl = sub.file_url
              }
            }
          }

          return {
            student: s,
            isSubmitted,
            submittedAt: sub?.submitted_at || sub?.submittedAt,
            note: sub?.note || null,
            fileUrl: resolvedFileUrl,
          }
        }
      })
    },
    [sortedStudents, examSubmissions, submissions]
  )

  if (allAssignments.length === 0) {
    return (
      <div
        className="mobile-card hard"
        style={{ padding: 18, background: '#FFFFFF', textAlign: 'center', color: '#64748B', borderRadius: 14 }}
      >
        هنوز هیچ تکلیفی برای کلاس ثبت نشده است.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Top action bar: Total assignments count and instant refresh */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#F8FAFC',
          padding: '10px 14px',
          borderRadius: 12,
          border: '1.5px solid #E2E8F0',
          fontSize: 13,
          color: '#334155',
          fontWeight: 700,
        }}
      >
        <span>
          📋 تعداد تکالیف فعال: <strong>{toPersianDigits(allAssignments.length)} مورد</strong> (جهت مشاهده جزئیات روی هر تکلیف کلیک کنید)
        </span>
        <button
          type="button"
          className="upload-btn"
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            fontSize: 12,
            padding: '5px 10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#FFFFFF',
            cursor: refreshing ? 'not-allowed' : 'pointer',
          }}
          title="محاسبه و دریافت مجدد وضعیت ارسال‌ها"
        >
          <span>{refreshing ? 'در حال دریافت...' : 'بروزرسانی لحظه‌ای'}</span>
          <span style={{ transform: refreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s ease' }}>
            🔄
          </span>
        </button>
      </div>

      {/* Accordion List of Assignments */}
      {allAssignments.map((assignment) => {
        const isExpanded = expandedAssignmentId === assignment.id
        const filterMode = filterModeMap[assignment.id] || 'all'
        const statuses = getAssignmentStatuses(assignment)
        const submittedCount = statuses.filter((st) => st.isSubmitted).length
        const missingCount = statuses.length - submittedCount
        const percent = statuses.length > 0 ? Math.round((submittedCount / statuses.length) * 100) : 0

        const filteredStatuses = statuses.filter((st) => {
          if (filterMode === 'submitted') return st.isSubmitted
          if (filterMode === 'missing') return !st.isSubmitted
          return true
        })

        return (
          <div
            key={assignment.id}
            className="mobile-card hard"
            style={{
              borderRadius: 14,
              border: isExpanded ? '2px solid #2563EB' : '2px solid #0F172A',
              background: isExpanded ? '#FFFFFF' : '#FAFAFA',
              overflow: 'hidden',
              transition: 'all 0.2s ease',
              boxShadow: isExpanded ? '0 6px 18px rgba(37,99,235,0.09)' : '0 2px 4px rgba(0,0,0,0.04)',
            }}
          >
            {/* Compact Header: Clickable to expand/collapse accordion */}
            <div
              onClick={() => setExpandedAssignmentId(isExpanded ? null : assignment.id)}
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                background: isExpanded ? '#EFF6FF' : '#FFFFFF',
                borderBottom: isExpanded ? '2px solid #DBEAFE' : 'none',
                userSelect: 'none',
              }}
            >
              {/* Right Side: Title & Deadline & Quick Stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18 }}>{assignment.isOnlineExam ? '🌟' : '📐'}</span>
                <div>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: 14.5,
                      fontWeight: 900,
                      color: isExpanded ? '#1D4ED8' : '#0F172A',
                    }}
                  >
                    {toPersianDigits(assignment.title)}
                  </h4>
                  {assignment.due_at && (
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      ⏰ مهلت تحویل: {toPersianDigits(new Date(assignment.due_at).toLocaleDateString('fa-IR'))}
                    </div>
                  )}
                </div>

                {/* Status Chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 8,
                      background: percent >= 70 ? '#DCFCE7' : percent >= 40 ? '#FEF3C7' : '#FEE2E2',
                      color: percent >= 70 ? '#166534' : percent >= 40 ? '#B45309' : '#991B1B',
                      border: '1px solid',
                      borderColor: percent >= 70 ? '#BBF7D0' : percent >= 40 ? '#FDE68A' : '#FECACA',
                    }}
                  >
                    🟢 {toPersianDigits(submittedCount)} از {toPersianDigits(statuses.length)} تحویل دادند ({toPersianDigits(percent)}٪)
                  </span>

                  {missingCount > 0 && (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 8,
                        background: '#FEF2F2',
                        color: '#991B1B',
                        border: '1px solid #FECACA',
                      }}
                    >
                      🔴 {toPersianDigits(missingCount)} نفر باقی‌مانده
                    </span>
                  )}
                </div>
              </div>

              {/* Left Side: Chevron Button */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: isExpanded ? '#1D4ED8' : '#64748B',
                  background: isExpanded ? '#DBEAFE' : '#F1F5F9',
                  padding: '5px 10px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                <span>{isExpanded ? 'بستن کشو' : 'مشاهده وضعیت'}</span>
                <span>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded Accordion Body */}
            {isExpanded && (
              <div style={{ padding: '14px 16px' }}>
                {/* Progress bar & statistics summary */}
                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: 12,
                    padding: 12,
                    border: '1.5px solid #E2E8F0',
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                      flexWrap: 'wrap',
                      gap: 6,
                    }}
                  >
                    <span style={{ fontWeight: 900, fontSize: 13.5, color: '#0F172A' }}>
                      📊 وضعیت تحویل لحظه‌ای: {toPersianDigits(submittedCount)} نفر تحویل داده‌اند • {toPersianDigits(missingCount)} نفر هنوز ارسال نکرده‌اند
                    </span>
                    {assignment.due_at && (
                      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>
                        تقویم مهلت: {toPersianDigits(new Date(assignment.due_at).toLocaleString('fa-IR'))}
                      </span>
                    )}
                  </div>

                  {/* Visual Bar */}
                  <div
                    style={{
                      width: '100%',
                      height: 10,
                      background: '#E2E8F0',
                      borderRadius: 999,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${percent}%`,
                        height: '100%',
                        background: percent >= 80 ? '#16A34A' : percent >= 50 ? '#EAB308' : '#DC2626',
                        borderRadius: 999,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>

                  {/* Filter chips */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="upload-btn"
                      style={{
                        fontSize: 12,
                        padding: '5px 12px',
                        background: filterMode === 'all' ? '#0F172A' : '#FFFFFF',
                        color: filterMode === 'all' ? '#FFFFFF' : '#0F172A',
                        borderColor: '#0F172A',
                      }}
                      onClick={() =>
                        setFilterModeMap((prev) => ({
                          ...prev,
                          [assignment.id]: 'all',
                        }))
                      }
                    >
                      همه دانش‌آموزان ({toPersianDigits(statuses.length)})
                    </button>
                    <button
                      type="button"
                      className="upload-btn"
                      style={{
                        fontSize: 12,
                        padding: '5px 12px',
                        background: filterMode === 'submitted' ? '#16A34A' : '#FFFFFF',
                        color: filterMode === 'submitted' ? '#FFFFFF' : '#166534',
                        borderColor: '#16A34A',
                      }}
                      onClick={() =>
                        setFilterModeMap((prev) => ({
                          ...prev,
                          [assignment.id]: 'submitted',
                        }))
                      }
                    >
                      🟢 تحویل داده‌اند ({toPersianDigits(submittedCount)})
                    </button>
                    <button
                      type="button"
                      className="upload-btn"
                      style={{
                        fontSize: 12,
                        padding: '5px 12px',
                        background: filterMode === 'missing' ? '#DC2626' : '#FFFFFF',
                        color: filterMode === 'missing' ? '#FFFFFF' : '#991B1B',
                        borderColor: '#DC2626',
                      }}
                      onClick={() =>
                        setFilterModeMap((prev) => ({
                          ...prev,
                          [assignment.id]: 'missing',
                        }))
                      }
                    >
                      🔴 تحویل نداده‌اند ({toPersianDigits(missingCount)})
                    </button>
                  </div>
                </div>

                {/* Students list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredStatuses.length === 0 ? (
                    <div style={{ padding: 12, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                      دانش‌آموزی در این فیلتر یافت نشد.
                    </div>
                  ) : (
                    filteredStatuses.map(({ student, isSubmitted, submittedAt, note, fileUrl }, idx) => (
                      <div
                        key={student.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: 12,
                          border: '1.5px solid',
                          borderColor: isSubmitted ? '#BBF7D0' : '#FECACA',
                          background: isSubmitted ? '#F0FDF4' : '#FEF2F2',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#64748B', width: 22 }}>
                            {toPersianDigits(idx + 1)}.
                          </span>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0F172A' }}>
                              {student.full_name}
                            </div>
                            {submittedAt && (
                              <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
                                زمان ارسال: {toPersianDigits(new Date(submittedAt).toLocaleString('fa-IR'))}
                              </div>
                            )}
                            {note && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#334155',
                                  background: '#FFFFFF',
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  marginTop: 4,
                                  border: '1px solid #CBD5E1',
                                  maxWidth: 420,
                                }}
                              >
                                💬 پاسخ دانش‌آموز: {toPersianDigits(note)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {fileUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setViewingAttachment({
                                  url: fileUrl,
                                  title: `تکلیف ${student.full_name}`,
                                })
                              }
                              className="upload-btn"
                              style={{
                                fontSize: 11.5,
                                padding: '4px 10px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              📎 فایل ضمیمه
                            </button>
                          )}
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              padding: '3px 10px',
                              borderRadius: 999,
                              background: isSubmitted ? '#DCFCE7' : '#FEE2E2',
                              color: isSubmitted ? '#166534' : '#991B1B',
                            }}
                          >
                            {isSubmitted ? '✅ تحویل داده شد' : '❌ تحویل نداده است'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Attachment viewer modal */}
      {viewingAttachment && (
        <AttachmentViewerModal
          url={viewingAttachment.url}
          title={viewingAttachment.title}
          onClose={() => setViewingAttachment(null)}
        />
      )}
    </div>
  )
}
