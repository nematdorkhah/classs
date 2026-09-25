import { useState } from 'react'
import { toPersianDigits } from '../utils/persianNumbers'
import { sanitizeExamTitle, getLocalExams, getLocalSubmissions } from '../utils/examStore'
import { sanitizeTeacherFeedback } from '../utils/cleanFeedback'
import ExamReviewModal from './ExamReviewModal'

export default function StudentReportCard({
  student,
  grades,
  attendanceRows,
  submissions,
  homeworkCount,
  reportNote,
  onClose,
}: {
  student: any
  grades: any[]
  attendanceRows: any[]
  submissions: any[]
  homeworkCount: number
  reportNote?: string
  onClose: () => void
}) {
  const [reviewExamData, setReviewExamData] = useState<{ exam: any; submission: any } | null>(null)

  // Normalize every grade to 20 ($Score = (Earned / Total) * 20$)
  const normalizedGrades = grades.map((g: any) => {
    let rawScore = Number(g.score) || 0
    let rawMax = Number(g.max_score) || 20

    // Match exam and submission if this represents an exam
    let matchedExam = g.exam || null
    let matchedSub = g.sub || null

    if (!matchedExam) {
      const allExams = getLocalExams()
      matchedExam =
        allExams.find((e) => {
          if (g.examId && e.id === g.examId) return true
          if (g.id && (`exam_sub_${e.id}` === g.id || `exam_${e.id}` === g.id)) return true
          const cleanE = sanitizeExamTitle(e.title, e.subject)
          const cleanG = sanitizeExamTitle(g.skill || '', g.subject)
          return cleanE && cleanG && (cleanE === cleanG || g.skill?.includes(cleanE))
        }) || null
    }

    if (!matchedSub && matchedExam) {
      const allSubs = getLocalSubmissions()
      matchedSub = allSubs.find((s) => s.examId === matchedExam.id && s.studentId === student.id) || null
    }

    if (matchedSub && matchedExam) {
      const subEarned =
        matchedSub.teacherGrading?.totalScore ??
        matchedSub.aiGrading?.totalScore ??
        matchedSub.studentScore
      if (subEarned !== undefined && subEarned !== null) {
        rawScore = Number(subEarned)
      }
      if (matchedExam.totalPoints || matchedExam.totalScore) {
        rawMax = Number(matchedExam.totalPoints || matchedExam.totalScore)
      }
    }

    // Exact formula: Score = (Earned / Total) * 20
    const scaledScore = rawMax > 0 ? Math.round(((rawScore / rawMax) * 20) * 10) / 10 : rawScore
    const cleanLabel = sanitizeTeacherFeedback(sanitizeExamTitle(g.skill || g.subject || 'عمومی', g.subject))

    return {
      ...g,
      rawScore,
      rawMax,
      scaledScore,
      cleanLabel,
      matchedExam,
      matchedSub,
    }
  })


  const gpaVal = normalizedGrades.length
    ? (normalizedGrades.reduce((acc: number, g: any) => acc + g.scaledScore, 0) / normalizedGrades.length).toFixed(2)
    : null

  const presents = attendanceRows.filter((a: any) => a.status === 'present').length
  const lates = attendanceRows.filter((a: any) => a.status === 'late').length
  const absents = attendanceRows.filter((a: any) => a.status === 'absent').length

  // Clean teacher feedback to strip any prompt instructions or JSON artifacts
  const cleanReportNote = sanitizeTeacherFeedback(reportNote)

  return (
    <div
      className="report-card-modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        overflowY: 'auto',
        direction: 'rtl',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-report, #printable-report * { visibility: visible; }
          #printable-report { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: 780,
          background: '#FFFFFF',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          border: '3px solid #0F172A',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Sticky Header with Close Button */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 18px',
            background: '#0F172A',
            color: '#FFFFFF',
            borderBottom: '2px solid #334155',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <span style={{ fontWeight: 800, fontSize: 15 }}>کارنامه رسمی عملکرد تحصیلی دانش‌آموز</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn"
              type="button"
              onClick={() => window.print()}
              style={{ padding: '6px 12px', fontSize: 13, background: '#2563EB', color: '#FFF' }}
            >
              🖨 چاپ کارنامه (PDF)
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#EF4444',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="خروج و بستن پنجره"
            >
              <span>✕</span>
              <span>خروج</span>
            </button>
          </div>
        </div>

        {/* Scrollable Printable Content */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, background: '#F8FAFC' }}>
          <div
            id="printable-report"
            style={{
              border: '2px solid #222',
              padding: 22,
              borderRadius: 14,
              direction: 'rtl',
              fontFamily: 'inherit',
              background: '#fff',
              color: '#111',
            }}
          >
            <div style={{ textAlign: 'center', borderBottom: '2px solid #222', paddingBottom: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900 }}>کارنامه جامع عملکرد تحصیلی — پایه ششم دبستان</h2>
              <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 13 }}>
                نام و نام خانوادگی: <strong>{student.full_name}</strong> | تاریخ صدور:{' '}
                {toPersianDigits(new Date().toLocaleDateString('fa-IR'))}
              </p>
            </div>

            {/* Attendance & GPA summary */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 16,
                fontSize: 13,
                flexWrap: 'wrap',
                gap: 10,
                background: '#F8FAFC',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #E2E8F0',
              }}
            >
              <div>
                حضور: <strong>{toPersianDigits(presents)}</strong> | تاخیر: <strong>{toPersianDigits(lates)}</strong> |
                غیبت: <strong>{toPersianDigits(absents)}</strong>
              </div>
              <div>
                تکالیف ارسالی: <strong>{toPersianDigits(submissions.length)} از {toPersianDigits(homeworkCount)}</strong>
              </div>
              <div>
                معدل کل دروس:{' '}
                <strong style={{ fontSize: 15, color: '#15803D' }}>
                  {gpaVal ? `${toPersianDigits(gpaVal)} از ۲۰` : '—'}
                </strong>
              </div>
            </div>

            {/* Grades Table */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'right',
                marginBottom: 20,
                fontSize: 13.5,
              }}
            >
              <thead>
                <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #94A3B8' }}>
                  <th style={{ padding: '10px 8px' }}>ردیف</th>
                  <th style={{ padding: '10px 8px' }}>درس / عنوان آزمون</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>نمره کسب‌شده (از ۲۰)</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>مقیاس استاندارد</th>
                  <th className="no-print" style={{ padding: '10px 8px', textAlign: 'center' }}>
                    جزئیات و پاسخنامه
                  </th>
                </tr>
              </thead>
              <tbody>
                {normalizedGrades.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 14, textAlign: 'center', color: '#64748B' }}>
                      هنوز نمره‌ای در سامانه ثبت نشده است.
                    </td>
                  </tr>
                )}
                {normalizedGrades.map((g: any, index: number) => {
                  const hasReview = Boolean(g.matchedExam && g.matchedSub)

                  return (
                    <tr
                      key={g.id || index}
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        background: hasReview ? '#FAFCFF' : 'transparent',
                        cursor: hasReview ? 'pointer' : 'default',
                        transition: 'background 0.15s ease',
                      }}
                      onClick={() => {
                        if (hasReview) {
                          setReviewExamData({
                            exam: g.matchedExam,
                            submission: g.matchedSub,
                          })
                        }
                      }}
                      title={hasReview ? 'برای مشاهده سوالات، گزینه‌ها و پاسخنامه کامل کلیک کنید' : undefined}
                    >
                      <td style={{ padding: '10px 8px' }}>{toPersianDigits(index + 1)}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <strong>{g.subject}</strong>
                        {g.cleanLabel && g.cleanLabel !== g.subject ? ` (${g.cleanLabel})` : ''}
                      </td>
                      <td
                        style={{
                          padding: '10px 8px',
                          fontWeight: 900,
                          textAlign: 'center',
                          color: g.scaledScore >= 16 ? '#15803D' : g.scaledScore >= 12 ? '#D97706' : '#DC2626',
                        }}
                      >
                        {toPersianDigits(g.scaledScore)}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>
                        {toPersianDigits(20)}
                      </td>
                      <td className="no-print" style={{ padding: '8px', textAlign: 'center' }}>
                        {hasReview ? (
                          <button
                            type="button"
                            className="upload-btn"
                            style={{
                              padding: '5px 12px',
                              fontSize: 12,
                              background: '#EFF6FF',
                              border: '1.5px solid #3B82F6',
                              color: '#1D4ED8',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              borderRadius: 8,
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setReviewExamData({
                                exam: g.matchedExam,
                                submission: g.matchedSub,
                              })
                            }}
                          >
                            <span>🔍 ریزنمرات و پاسخنامه</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>ثبت نمره کلاسی</span>
                        )}
                      </td>
                    </tr>
                  )

                })}
              </tbody>
            </table>

            {/* Clean Pedagogical Teacher Notes */}
            <div
              style={{
                border: '1.5px dashed #94A3B8',
                padding: 16,
                borderRadius: 12,
                minHeight: 70,
                fontSize: 13,
                background: '#F8FAFC',
              }}
            >
              <strong style={{ color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✍️</span>
                <span>توضیحات و توصیه‌های آموزشی آموزگار:</span>
              </strong>
              {cleanReportNote ? (
                <p
                  style={{
                    margin: '8px 0 0 0',
                    lineHeight: 1.8,
                    whiteSpace: 'pre-wrap',
                    color: '#1E293B',
                    fontWeight: 600,
                  }}
                >
                  {cleanReportNote}
                </p>
              ) : (
                <p
                  style={{
                    margin: '8px 0 0 0',
                    color: '#64748B',
                    fontStyle: 'italic',
                    fontSize: 12.5,
                  }}
                >
                  (عملکرد کلاسی و تکالیف دانش‌آموز به طور مستمر توسط آموزگار رصد و ثبت می‌شود.)
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal Popup when student clicks on any exam row */}
      {reviewExamData && (
        <ExamReviewModal
          exam={reviewExamData.exam}
          submission={reviewExamData.submission}
          onClose={() => setReviewExamData(null)}
        />
      )}
    </div>
  )
}
