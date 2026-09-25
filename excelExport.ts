import * as XLSX from 'xlsx'
import { getLocalExams, getLocalSubmissions } from './examStore'

export interface ExportClassDataParams {
  students: any[]
  grades: any[]
  submissions: any[]
  allAttendance: any[]
  homeworkPosts: any[]
}

export function exportClassroomToExcel({
  students,
  grades,
  submissions,
  allAttendance,
  homeworkPosts,
}: ExportClassDataParams) {
  // 1. Sort students alphabetically by Persian full_name
  const sortedStudents = [...students].sort((a, b) =>
    (a.full_name || '').localeCompare(b.full_name || '', 'fa')
  )

  // 2. Load exams and exam submissions to integrate exam grades
  const localExams = getLocalExams()
  const examSubs = getLocalSubmissions()
  const examMap = new Map(localExams.map((e) => [e.id, e]))

  // Combined grades map: studentId -> array of grade objects
  const combinedGradesMap = new Map<string, any[]>()
  for (const s of sortedStudents) {
    combinedGradesMap.set(s.id, [])
  }
  for (const g of grades) {
    if (combinedGradesMap.has(g.student_id)) {
      combinedGradesMap.get(g.student_id)!.push(g)
    }
  }
  // Inject exam grades
  for (const sub of examSubs) {
    const exam = examMap.get(sub.examId)
    if (!exam) continue
    const score = sub.teacherGrading?.totalScore ?? sub.aiGrading?.totalScore ?? (sub as any).studentScore
    if (score === undefined || score === null) continue
    const sGrades = combinedGradesMap.get(sub.studentId)
    if (sGrades) {
      const already = sGrades.some((g) => g.skill === `آزمون: ${exam.title}` || g.skill === exam.title)
      if (!already) {
        sGrades.push({
          subject: exam.subject || 'عمومی',
          skill: `آزمون: ${exam.title}`,
          score: Number(score),
          max_score: exam.totalPoints || 20,
          recorded_at: sub.submittedAt,
        })
      }
    }
  }

  // 3. Prepare Sheet 1: Master Summary (گزارش جامع کلاس)
  const masterRows = sortedStudents.map((student, idx) => {
    const sGrades = combinedGradesMap.get(student.id) || []
    const avgScore = sGrades.length
      ? Number(
          (
            sGrades.reduce((sum, g) => sum + (Number(g.score) / Number(g.max_score || 20)) * 20, 0) /
            sGrades.length
          ).toFixed(2)
        )
      : 'ثبت نشده'

    let qualitativeStatus = '—'
    if (typeof avgScore === 'number') {
      if (avgScore >= 18) qualitativeStatus = 'خیلی خوب'
      else if (avgScore >= 15) qualitativeStatus = 'خوب'
      else if (avgScore >= 12) qualitativeStatus = 'قابل قبول'
      else qualitativeStatus = 'نیازمند تلاش'
    }

    const sSubs = submissions.filter((sub) => sub.student_id === student.id)
    const submittedHwCount = sSubs.length
    const totalHw = homeworkPosts.length
    const hwSubmissionRate = totalHw > 0 ? `${Math.round((submittedHwCount / totalHw) * 100)}%` : '۱۰۰٪'

    const sAtt = allAttendance.filter((a) => a.student_id === student.id)
    const presents = sAtt.filter((a) => a.status === 'present').length
    const lates = sAtt.filter((a) => a.status === 'late').length
    const absents = sAtt.filter((a) => a.status === 'absent').length

    return {
      'ردیف': idx + 1,
      'نام و نام خانوادگی': student.full_name,
      'رمز عبور / کد ملی': student.access_code || '—',
      'میانگین نمرات (از ۲۰)': avgScore,
      'سطح کیفی': qualitativeStatus,
      'تعداد نمرات': sGrades.length,
      'تکالیف تحویل‌شده': `${submittedHwCount} از ${totalHw}`,
      'درصد تحویل تکالیف': hwSubmissionRate,
      'تعداد روزهای حاضر': presents,
      'تعداد تاخیرها': lates,
      'تعداد غیبت‌ها': absents,
    }
  })

  // 4. Prepare Sheet 2: Homework Status Matrix (ماتریس تکالیف)
  const assignmentExams = localExams.filter((e) => e.mode === 'assignment')
  const homeworkMatrixRows = sortedStudents.map((student, idx) => {
    const sSubs = submissions.filter((sub) => sub.student_id === student.id)
    const sExamSubs = examSubs.filter((sub) => sub.studentId === student.id && assignmentExams.some((ae) => ae.id === sub.examId))
    const totalAllAssignments = homeworkPosts.length + assignmentExams.length
    const totalSubmittedAll = sSubs.length + sExamSubs.length

    const row: Record<string, any> = {
      'ردیف': idx + 1,
      'نام دانش‌آموز': student.full_name,
      'مجموع ارسالی': `${totalSubmittedAll} از ${totalAllAssignments}`,
    }

    homeworkPosts.forEach((hw, hIdx) => {
      const colName = `تکلیف ${hIdx + 1}: ${hw.title}`
      const sub = sSubs.find((s) => s.post_id === hw.id)
      if (sub) {
        let noteSummary = ''
        if (sub.note) noteSummary = ` (پاسخ: ${sub.note.slice(0, 30)}${sub.note.length > 30 ? '...' : ''})`
        row[colName] = `✅ تحویل داده شد${noteSummary}`
      } else {
        const isPastDue = hw.due_at && new Date(hw.due_at) < new Date()
        row[colName] = isPastDue ? '❌ مهلت گذشته (ارسال نشده)' : '⏳ در انتظار انجام'
      }
    })

    assignmentExams.forEach((asg, aIdx) => {
      const colName = `تکلیف آنلاین ${aIdx + 1}: ${asg.title}`
      const asgSub = examSubs.find((s) => s.examId === asg.id && s.studentId === student.id)
      if (asgSub) {
        const sc = asgSub.teacherGrading?.totalScore ?? asgSub.aiGrading?.totalScore ?? (asgSub as any).studentScore
        row[colName] = `✅ ارسال شد${sc !== undefined && sc !== null ? ` (نمره: ${sc})` : ''}`
      } else {
        const isPast = asg.dueDate && new Date(asg.dueDate) < new Date()
        row[colName] = isPast ? '❌ مهلت گذشته (ارسال نشده)' : '⏳ در انتظار انجام'
      }
    })

    return row
  })

  // 5. Prepare Sheet 3: Detailed Grades & Exams (ریز نمرات و آزمون‌ها)
  const detailedGradeRows: any[] = []
  sortedStudents.forEach((student) => {
    const sGrades = combinedGradesMap.get(student.id) || []
    sGrades.forEach((g, gIdx) => {
      detailedGradeRows.push({
        'نام دانش‌آموز': student.full_name,
        'کد ملی': student.access_code || '—',
        'شماره نمره': gIdx + 1,
        'درس': g.subject || 'عمومی',
        'مبحث / عنوان آزمون': g.skill || 'فعالیت کلاسی',
        'نمره کسب‌شده': g.score,
        'نمره کل': g.max_score || 20,
        'نمره تبدیل‌شده به ۲۰': Number(((Number(g.score) / Number(g.max_score || 20)) * 20).toFixed(2)),
        'تاریخ ثبت': g.recorded_at ? new Date(g.recorded_at).toLocaleDateString('fa-IR') : '—',
      })
    })
  })

  // 6. Build XLSX Workbook
  const wb = XLSX.utils.book_new()

  const wsMaster = XLSX.utils.json_to_sheet(masterRows)
  wsMaster['!cols'] = [
    { wch: 6 },  // ردیف
    { wch: 24 }, // نام
    { wch: 18 }, // رمز
    { wch: 18 }, // میانگین
    { wch: 14 }, // سطح
    { wch: 12 }, // تعداد
    { wch: 18 }, // تکالیف
    { wch: 16 }, // درصد
    { wch: 16 }, // حاضر
    { wch: 14 }, // تاخیر
    { wch: 14 }, // غیبت
  ]
  XLSX.utils.book_append_sheet(wb, wsMaster, 'کارنامه جامع کلاس')

  const wsHw = XLSX.utils.json_to_sheet(homeworkMatrixRows)
  XLSX.utils.book_append_sheet(wb, wsHw, 'وضعیت تکالیف')

  if (detailedGradeRows.length > 0) {
    const wsGrades = XLSX.utils.json_to_sheet(detailedGradeRows)
    XLSX.utils.book_append_sheet(wb, wsGrades, 'ریز نمرات و آزمون‌ها')
  }

  // 7. Write and trigger download
  const dateStr = new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')
  const fileName = `گزارش_جامع_کلاس_ششم_${dateStr}.xlsx`
  XLSX.writeFile(wb, fileName)
}
