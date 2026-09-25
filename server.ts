import express from 'express'
import path from 'path'
import fs from 'fs'
import { createServer as createViteServer } from 'vite'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'

const CANDIDATE_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite']

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ephgqrnbpxvxlzloflhy.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_bI5v4Hzokb0A4JWJDzuz1A_4B3lIUX_'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const SERVER_DATA_DIR = path.join(process.cwd(), 'server_data')
if (!fs.existsSync(SERVER_DATA_DIR)) {
  try {
    fs.mkdirSync(SERVER_DATA_DIR, { recursive: true })
  } catch (e) {
    console.error('Failed to create server_data directory', e)
  }
}

function readJsonFile<T>(filename: string, defaultValue: T): T {
  try {
    const fullPath = path.join(SERVER_DATA_DIR, filename)
    if (!fs.existsSync(fullPath)) return defaultValue
    const content = fs.readFileSync(fullPath, 'utf8')
    return JSON.parse(content)
  } catch (e) {
    console.warn(`Failed to read ${filename}`, e)
    return defaultValue
  }
}

function writeJsonFile<T>(filename: string, data: T): void {
  try {
    const fullPath = path.join(SERVER_DATA_DIR, filename)
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8')
  } catch (e) {
    console.error(`Failed to write ${filename}`, e)
  }
}

function sanitizeTeacherNote(text?: string): string {
  if (!text) return ''
  let cleaned = String(text).trim()
  if (cleaned.startsWith('{') || cleaned.includes('"teacherSummaryNote"')) {
    try {
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) {
        const p = JSON.parse(m[0])
        cleaned = p.teacherSummaryNote || p.teacherNotes || p.summary || p.feedback || cleaned
      }
    } catch {}
  }
  cleaned = cleaned.replace(/```(?:json)?[\s\S]*?```/g, '').trim()
  const badPatterns = [
    /شما آموزگار مهربان.*?(?:هستید|باشید)[.،:\n]/gi,
    /وظایف شما:.*?(?=\n[۱-۹]|\n[A-Z]|\n\n|$)/gis,
    /اطلاعات سوالات، بارم.*?(?=\n\n|$)/gis,
    /خروجی صرفاً JSON.*?(?=\n\n|$)/gis,
    /System Instructions?:?.*?(?=\n\n|$)/gis,
    /Prompt:?.*?(?=\n\n|$)/gis,
    /\{\s*"grades"[\s\S]*?\}/gis,
  ]
  for (const b of badPatterns) cleaned = cleaned.replace(b, '')
  return cleaned.replace(/^[\{\}\[\]"'\s]+|[\{\}\[\]"'\s]+$/g, '').trim()
}

async function verifyTeacher(password?: string): Promise<boolean> {
  if (!password) return false
  try {
    const { data, error } = await supabase.rpc('verify_teacher', { p_password: password })
    if (!error && data) return true
  } catch (err) {
    console.warn('Teacher verification failed', err)
  }
  return false
}

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  })
}

async function callGeminiWithFallbacks(prompt: string, responseJson = false): Promise<string> {
  const ai = getGeminiClient()
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server.')
  }

  let lastError: any = null
  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: responseJson ? { responseMimeType: 'application/json' } : undefined,
      })
      if (res && res.text) {
        return res.text.trim()
      }
    } catch (err: any) {
      console.warn(`[Gemini] Model ${model} failed:`, err?.message || err)
      lastError = err
    }
  }

  throw lastError || new Error('خطا در برقراری ارتباط با مدل‌های هوش مصنوعی')
}

async function startServer() {
  const app = express()
  const PORT = 3000

  app.use(express.json({ limit: '20mb' }))

  // AI Endpoint protection middleware
  const requireAiAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const teacherPass = (req.headers['x-teacher-password'] as string) || req.body?.teacherPassword
    if (teacherPass) {
      const ok = await verifyTeacher(teacherPass)
      if (ok) return next()
    }
    const studentId = (req.headers['x-student-id'] as string) || req.body?.studentId
    if (studentId) {
      return next()
    }
    // Allow local dev requests
    if (process.env.NODE_ENV !== 'production') {
      return next()
    }
    return res.status(401).json({ success: false, error: 'دسترسی غیرمجاز. احراز هویت الزامی است.' })
  }

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    })
  })

  // --------------------------------------------------------------------------
  // EXAM CRUD & PERSISTENCE (With Student Answer-Key Stripping for Security)
  // --------------------------------------------------------------------------
  app.get('/api/exams', (req, res) => {
    const role = (req.query.role as string) || 'student'
    const exams = readJsonFile<any[]>('exams.json', [])

    if (role === 'student') {
      // SECURITY FIX: Strip correctAnswer and rubricOrHint so student inspect element cannot leak answers!
      const sanitized = exams
        .filter((e) => e.published)
        .map((exam) => ({
          ...exam,
          questions: (exam.questions || []).map((q: any) => {
            const { correctAnswer, rubricOrHint, ...safeQuestion } = q
            return safeQuestion
          }),
        }))
      return res.json({ success: true, exams: sanitized })
    }

    res.json({ success: true, exams })
  })

  app.post('/api/exams/save', async (req, res) => {
    try {
      const { exam, teacherPassword } = req.body
      if (!exam || !exam.id) {
        return res.status(400).json({ success: false, error: 'اطلاعات آزمون ناقص است.' })
      }
      const current = readJsonFile<any[]>('exams.json', [])
      const idx = current.findIndex((e) => e.id === exam.id)
      if (idx >= 0) {
        current[idx] = exam
      } else {
        current.unshift(exam)
      }
      writeJsonFile('exams.json', current)

      if (teacherPassword) {
        try {
          await supabase.rpc('teacher_create_post', {
            p_password: teacherPassword,
            p_type: 'exam',
            p_title: `📝 آزمون: ${exam.title} (${exam.subject})`,
            p_body: JSON.stringify(exam),
            p_due_at: new Date(new Date(exam.scheduledStartTime).getTime() + (exam.durationMinutes || 45) * 60000).toISOString(),
            p_publish_at: new Date(exam.scheduledStartTime || Date.now()).toISOString(),
            p_attachment_path: null,
          })
        } catch (e) {
          console.warn('Sync exam post to Supabase failed', e)
        }
      }

      res.json({ success: true, exam })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'خطا در ذخیره آزمون' })
    }
  })

  app.post('/api/exams/delete', (req, res) => {
    const { examId } = req.body
    if (!examId) return res.status(400).json({ success: false, error: 'examId is required' })
    const current = readJsonFile<any[]>('exams.json', [])
    const filtered = current.filter((e) => e.id !== examId)
    writeJsonFile('exams.json', filtered)
    res.json({ success: true })
  })

  // Teacher delete post endpoint (for homework and announcements)
  app.post('/api/teacher/delete-post', async (req, res) => {
    try {
      const { teacherPassword, postId } = req.body
      if (!teacherPassword || !(await verifyTeacher(teacherPassword))) {
        return res.status(401).json({ success: false, error: 'رمز عبور آموزگار صحیح نمی‌باشد.' })
      }
      if (!postId) {
        return res.status(400).json({ success: false, error: 'شناسه پست ارسال نشده است.' })
      }

      // Also clean up if this was linked to exams.json
      try {
        const exams = readJsonFile<any[]>('exams.json', [])
        const remaining = exams.filter((e) => e.id !== postId)
        if (remaining.length !== exams.length) {
          writeJsonFile('exams.json', remaining)
        }
      } catch (e) {
        console.warn('Cleaning exams.json failed:', e)
      }

      // 1. Delete dependent submissions
      try {
        await supabase.from('submissions').delete().eq('post_id', postId)
      } catch (e) {
        console.warn('Deleting dependent submissions error:', e)
      }

      // 2. Try Supabase RPC
      let rpcOk = false
      try {
        const { error } = await supabase.rpc('teacher_delete_post', {
          p_password: teacherPassword,
          p_post_id: postId,
        })
        if (!error) rpcOk = true
      } catch (e) {
        console.warn('RPC teacher_delete_post failed:', e)
      }

      // 3. Fallback direct delete
      if (!rpcOk) {
        const { error: directErr } = await supabase.from('posts').delete().eq('id', postId)
        if (directErr) {
          console.warn('Direct delete from posts failed:', directErr)
        }
      }

      return res.json({ success: true })
    } catch (err: any) {
      console.error('Delete post failed:', err)
      return res.status(500).json({ success: false, error: err?.message || 'خطا در حذف پست' })
    }
  })

  // --------------------------------------------------------------------------
  // EXAM SUBMISSIONS & SERVER-SIDE GRADING
  // --------------------------------------------------------------------------
  app.get('/api/exams/submissions', (req, res) => {
    const { examId, studentId } = req.query
    let subs = readJsonFile<any[]>('exam_submissions.json', [])
    if (examId) {
      subs = subs.filter((s) => s.examId === examId)
    }
    if (studentId) {
      subs = subs.filter((s) => s.studentId === studentId)
    }
    res.json({ success: true, submissions: subs })
  })

  app.post('/api/exams/submit', async (req, res) => {
    try {
      const { examId, studentId, studentName, answers, clientExam } = req.body
      if (!examId || !studentId) {
        return res.status(400).json({ success: false, error: 'examId and studentId are required' })
      }

      const exams = readJsonFile<any[]>('exams.json', [])
      let masterExam = exams.find((e) => e.id === examId)
      // Fallback to clientExam if newly created or offline
      if (!masterExam && clientExam) {
        masterExam = clientExam
        exams.unshift(clientExam)
        writeJsonFile('exams.json', exams)
      }

      if (!masterExam) {
        return res.status(404).json({ success: false, error: 'آزمون یافت نشد.' })
      }

      const questionScores: Record<string, number> = {}
      const questionFeedbacks: Record<string, string> = {}
      let totalScore = 0
      const questionsToAiGrade: any[] = []

      for (const q of masterExam.questions) {
        const studentAns = answers?.[q.id] || {}
        if (q.type === 'multiple_choice') {
          const selected = studentAns.selectedOption
          const correct = q.correctAnswer
          if (selected !== undefined && Number(selected) === Number(correct)) {
            const pts = Number(q.points) || 2
            questionScores[q.id] = pts
            questionFeedbacks[q.id] = '✅ پاسخ کاملاً درست است.'
            totalScore += pts
          } else {
            questionScores[q.id] = 0
            questionFeedbacks[q.id] = `❌ پاسخ نادرست است. گزینه صحیح: گزینه ${Number(correct ?? 0) + 1}`
          }
        } else if (q.type === 'fill_in_the_blank') {
          const text = String(studentAns.textAnswer || '').trim().toLowerCase()
          const correct = String(q.correctAnswer || '').trim().toLowerCase()
          if (text && (text === correct || text.includes(correct) || correct.includes(text))) {
            const pts = Number(q.points) || 2
            questionScores[q.id] = pts
            questionFeedbacks[q.id] = '✅ پاسخ جای خالی درست است.'
            totalScore += pts
          } else {
            questionScores[q.id] = 0
            questionFeedbacks[q.id] = `❌ پاسخ نادرست یا خالی است. پاسخ صحیح: «${q.correctAnswer}»`
          }
        } else {
          // Descriptive or image questions: prepare for AI grading
          questionsToAiGrade.push({
            id: q.id,
            question: q.question,
            rubricOrHint: q.rubricOrHint || '',
            points: Number(q.points) || 3,
            studentAnswer: studentAns.textAnswer || (studentAns.imageAttachment ? '[تصویر پیوست شده]' : ''),
          })
        }
      }

      let serverTeacherNote = ''
      if (questionsToAiGrade.length > 0 && process.env.GEMINI_API_KEY) {
        try {
          const aiPrompt = `شما آموزگار مهربان، دلسوز و باتجربه پایه ششم ابتدایی هستید. دانش‌آموز «${studentName || 'دانش‌آموز'}» به سوالات تشریحی آزمون پاسخ داده است.
اطلاعات سوالات، بارم، راهنمای حل و پاسخ ثبت‌شده دانش‌آموز:
${JSON.stringify(questionsToAiGrade, null, 2)}

وظایف شما:
۱. برای هر سوال نمره منصفانه بر اساس پاسخ و بازخورد آموزنده بنویسید.
۲. یک یادداشت معلمانه کوتاه و انگیزشی (teacherSummaryNote) مستقیماً با لحن آموزگار خطاب به دانش‌آموز بنویسید.
خروجی صرفاً JSON:
{
  "grades": [{ "id": "...", "score": 2.5, "feedback": "..." }],
  "teacherSummaryNote": "..."
}`
          const aiResText = await callGeminiWithFallbacks(aiPrompt, true)
          let cleaned = aiResText.trim()
          if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim()
          if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim()
          const parsed = JSON.parse(cleaned)
          const gradesArr = Array.isArray(parsed) ? parsed : parsed.grades || []
          serverTeacherNote = parsed.teacherSummaryNote || ''
          for (const g of gradesArr) {
            const matchingQ = masterExam.questions.find((mq: any) => mq.id === g.id)
            const maxPts = Number(matchingQ?.points) || 3
            const safeScore = Math.min(maxPts, Math.max(0, Number(g.score) || 0))
            questionScores[g.id] = safeScore
            questionFeedbacks[g.id] = g.feedback || 'پاسخ بررسی شد.'
            totalScore += safeScore
          }
        } catch (e) {
          console.warn('AI grading failed, using heuristic grading', e)
          for (const q of questionsToAiGrade) {
            const text = String(q.studentAnswer || '').trim()
            let earned = 0
            let fb = ''
            if (text.length > 30) {
              earned = q.points
              fb = 'پاسخ کامل یا راه‌حل ثبت شده است.'
            } else if (text.length > 0) {
              earned = Math.round(q.points * 0.5 * 10) / 10
              fb = 'پاسخ مختصر درج شده است.'
            } else {
              fb = 'پاسخی ثبت نشده است.'
            }
            questionScores[q.id] = earned
            questionFeedbacks[q.id] = fb
            totalScore += earned
          }
        }
      }

      serverTeacherNote = sanitizeTeacherNote(serverTeacherNote)
      if (!serverTeacherNote) {
        const ratio = totalScore / (masterExam.totalPoints || 20)
        if (ratio >= 0.85) {
          serverTeacherNote = `آفرین ${studentName} عزیزم! عملکردت در این آزمون بسیار عالی و چشم‌گیر بود و تسلط خوبی روی مفاهیم نشان دادی. همین مسیر باانگیزه را ادامه بده.`
        } else if (ratio >= 0.6) {
          serverTeacherNote = `خسته نباشی ${studentName} جان؛ تلاشت در آزمون خوب بود. در سوالات تشریحی و نکته‌دار کمی بیشتر دقت کن تا در آزمون‌های بعدی نمره کامل را به دست آوری.`
        } else {
          serverTeacherNote = `${studentName} عزیز، خسته نباشی. نیاز است مباحث این درس را مجدداً با دقت مرور کنی و روی تمرین‌های کاربرگ کار کنی تا نقاط ضعف به نقطه قوت تبدیل شوند.`
        }
      }

      const masterTotal = Number(masterExam.totalPoints) || 20
      const scaledScore20 = masterTotal > 0 ? Math.round(((totalScore / masterTotal) * 20) * 10) / 10 : totalScore
      const roundedScore = Math.round(totalScore * 10) / 10
      const submission = {
        id: `sub_${examId}_${studentId}_${Date.now()}`,
        examId,
        studentId,
        studentName: studentName || 'دانش‌آموز',
        submittedAt: new Date().toISOString(),
        answers,
        aiGrading: {
          questionScores,
          questionFeedbacks,
          totalScore: roundedScore,
          scaledScore20,
          gradedAt: new Date().toISOString(),
          summary: serverTeacherNote,
        },
        teacherGrading: {
          approved: false,
          questionScores: { ...questionScores },
          questionFeedbacks: { ...questionFeedbacks },
          totalScore: roundedScore,
          scaledScore20,
          teacherNotes: serverTeacherNote,
        },
      }

      const allSubs = readJsonFile<any[]>('exam_submissions.json', [])
      const filteredSubs = allSubs.filter((s) => !(s.examId === examId && s.studentId === studentId))
      filteredSubs.push(submission)
      writeJsonFile('exam_submissions.json', filteredSubs)

      res.json({ success: true, submission })
    } catch (err: any) {
      console.error('Error in exam submit:', err)
      res.status(500).json({ success: false, error: err?.message || 'خطا در ثبت آزمون' })
    }
  })

  app.post('/api/exams/approve', async (req, res) => {
    try {
      const { submissionId, approvedScores, teacherNotes, teacherPassword } = req.body
      if (!submissionId) {
        return res.status(400).json({ success: false, error: 'submissionId is required' })
      }
      const allSubs = readJsonFile<any[]>('exam_submissions.json', [])
      const sub = allSubs.find((s) => s.id === submissionId)
      if (!sub) {
        return res.status(404).json({ success: false, error: 'پاسخ آزمون یافت نشد.' })
      }

      let totalScore = 0
      if (approvedScores) {
        for (const val of Object.values(approvedScores)) {
          totalScore += Number(val) || 0
        }
      } else {
        totalScore = sub.aiGrading?.totalScore || 0
      }
      totalScore = Math.round(totalScore * 10) / 10

      const exams = readJsonFile<any[]>('exams.json', [])
      const exam = exams.find((e) => e.id === sub.examId)
      const examTotalPts = Number(exam?.totalPoints) || 20
      const scaledScore20 = examTotalPts > 0 ? Math.round(((totalScore / examTotalPts) * 20) * 10) / 10 : totalScore
      const cleanNote = sanitizeTeacherNote(teacherNotes || sub.aiGrading?.summary || 'تایید شده توسط آموزگار محترم')

      sub.teacherGrading = {
        approved: true,
        questionScores: approvedScores || sub.aiGrading?.questionScores || {},
        questionFeedbacks: sub.teacherGrading?.questionFeedbacks,
        teacherNotes: cleanNote,
        totalScore,
        scaledScore20,
        approvedAt: new Date().toISOString(),
      }

      writeJsonFile('exam_submissions.json', allSubs)

      if (teacherPassword) {
        try {
          await supabase.rpc('teacher_add_grade', {
            p_password: teacherPassword,
            p_student_id: sub.studentId,
            p_subject: exam?.subject || 'عمومی',
            p_skill: `آزمون: ${exam?.title || 'آزمون کلاسی'}`,
            p_score: scaledScore20,
            p_max_score: 20,
          })
        } catch (e) {
          console.warn('Could not record grade to Supabase gradebook', e)
        }
      }

      res.json({ success: true, submission: sub })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'خطا در تایید آزمون' })
    }
  })

  // --------------------------------------------------------------------------
  // TIZHOOSHAN DUOLINGO PROGRESS API (Cloud Persistent for Every Student)
  // --------------------------------------------------------------------------
  app.get('/api/tizhooshan/progress', (req, res) => {
    const { studentId } = req.query
    if (!studentId) return res.status(400).json({ success: false, error: 'studentId is required' })
    const map = readJsonFile<Record<string, any>>('tizhooshan_progress.json', {})
    const progress = map[String(studentId)] || null
    res.json({ success: true, progress })
  })

  app.get('/api/tizhooshan/all-progress', (req, res) => {
    const map = readJsonFile<Record<string, any>>('tizhooshan_progress.json', {})
    res.json({ success: true, progressMap: map })
  })

  app.post('/api/tizhooshan/progress', (req, res) => {
    const { studentId, studentName, progress } = req.body
    if (!studentId || !progress) {
      return res.status(400).json({ success: false, error: 'studentId and progress are required' })
    }
    const map = readJsonFile<Record<string, any>>('tizhooshan_progress.json', {})
    map[String(studentId)] = {
      studentId,
      studentName: studentName || map[String(studentId)]?.studentName || '',
      ...progress,
      updatedAt: new Date().toISOString(),
    }
    writeJsonFile('tizhooshan_progress.json', map)
    res.json({ success: true })
  })

  // --------------------------------------------------------------------------
  // COMPLETE SYSTEM BACKUP RESTORE (All Sections: Exams, Progress, Submissions)
  // --------------------------------------------------------------------------
  app.post('/api/backup/restore', async (req, res) => {
    try {
      const { backup } = req.body
      if (!backup || typeof backup !== 'object') {
        return res.status(400).json({ success: false, error: 'فایل پشتیبان نامعتبر است.' })
      }
      if (Array.isArray(backup.exams)) {
        writeJsonFile('exams.json', backup.exams)
      }
      if (Array.isArray(backup.examSubmissions)) {
        writeJsonFile('exam_submissions.json', backup.examSubmissions)
      }
      if (backup.tizhooshanProgress && typeof backup.tizhooshanProgress === 'object') {
        writeJsonFile('tizhooshan_progress.json', backup.tizhooshanProgress)
      }
      res.json({ success: true, message: 'پشتیبان سیستم با موفقیت در پایگاه داده سرور ذخیره و اعمال شد.' })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'خطا در بازیابی سرور' })
    }
  })

  // --------------------------------------------------------------------------
  // AI EXAM QUESTIONS GENERATOR (Genuine curriculum questions, NO templates)
  // --------------------------------------------------------------------------
  app.post('/api/ai/generate-exam', requireAiAuth, async (req, res) => {
    try {
      const {
        subject = '',
        topic = '',
        count = 5,
        types = ['multiple_choice', 'fill_in_the_blank', 'descriptive'],
        difficulty = 'medium',
        extraInstructions = '',
      } = req.body

      const rawTopic = String(topic || '').trim()
      if (!rawTopic) {
        return res.status(400).json({ success: false, error: 'موضوع آزمون مشخص نشده است.' })
      }

      // Intelligent subject inference
      let effectiveSubject = subject && subject.trim() ? subject.trim() : ''
      const lowerTopic = rawTopic.toLowerCase()

      if (
        lowerTopic.includes('علوم') ||
        lowerTopic.includes('گوارش') ||
        lowerTopic.includes('معده') ||
        lowerTopic.includes('بلع') ||
        lowerTopic.includes('روده') ||
        lowerTopic.includes('گردش خون') ||
        lowerTopic.includes('قلب') ||
        lowerTopic.includes('تنفس') ||
        lowerTopic.includes('شش') ||
        lowerTopic.includes('زلزله') ||
        lowerTopic.includes('سنگ') ||
        lowerTopic.includes('زمین') ||
        lowerTopic.includes('خاک') ||
        lowerTopic.includes('میکروسکوپ') ||
        lowerTopic.includes('سلول') ||
        lowerTopic.includes('نیرو') ||
        lowerTopic.includes('اهرم') ||
        lowerTopic.includes('انرژی') ||
        lowerTopic.includes('اسید') ||
        lowerTopic.includes('کاغذ') ||
        lowerTopic.includes('آتشفشان') ||
        lowerTopic.includes('گیاه') ||
        lowerTopic.includes('فتوسنتز') ||
        lowerTopic.includes('مخلوط') ||
        lowerTopic.includes('محلول') ||
        lowerTopic.includes('آهنربا') ||
        lowerTopic.includes('مدار') ||
        lowerTopic.includes('اصطکاک') ||
        lowerTopic.includes('آزمایش')
      ) {
        effectiveSubject = 'علوم تجربی'
      } else if (
        lowerTopic.includes('ریاضی') ||
        lowerTopic.includes('کسر') ||
        lowerTopic.includes('اعشار') ||
        lowerTopic.includes('مساحت') ||
        lowerTopic.includes('محیط') ||
        lowerTopic.includes('حجم') ||
        lowerTopic.includes('تناسب') ||
        lowerTopic.includes('مختصات') ||
        lowerTopic.includes('تقارن') ||
        lowerTopic.includes('زاویه') ||
        lowerTopic.includes('احتمال') ||
        lowerTopic.includes('اعداد صحیح') ||
        lowerTopic.includes('هندسه') ||
        lowerTopic.includes('درصد') ||
        lowerTopic.includes('تقسیم') ||
        lowerTopic.includes('ضرب')
      ) {
        effectiveSubject = 'ریاضی'
      } else if (
        lowerTopic.includes('فارسی') ||
        lowerTopic.includes('شعر') ||
        lowerTopic.includes('آرایه') ||
        lowerTopic.includes('تشبیه') ||
        lowerTopic.includes('کنایه') ||
        lowerTopic.includes('مفعول') ||
        lowerTopic.includes('نهاد') ||
        lowerTopic.includes('مسند') ||
        lowerTopic.includes('انشا') ||
        lowerTopic.includes('نگارش') ||
        lowerTopic.includes('ستایش') ||
        lowerTopic.includes('نیایش') ||
        lowerTopic.includes('املا')
      ) {
        effectiveSubject = 'فارسی'
      } else if (
        lowerTopic.includes('تیزهوشان') ||
        lowerTopic.includes('سمپاد') ||
        lowerTopic.includes('هوش') ||
        lowerTopic.includes('استعداد تحلیلی') ||
        lowerTopic.includes('مکعب') ||
        lowerTopic.includes('تاس') ||
        lowerTopic.includes('چرخ دنده')
      ) {
        effectiveSubject = 'هوش و استعداد تحلیلی (تیزهوشان)'
      } else if (
        lowerTopic.includes('هدیه') ||
        lowerTopic.includes('دینی') ||
        lowerTopic.includes('پیامبر') ||
        lowerTopic.includes('امام') ||
        lowerTopic.includes('نماز') ||
        lowerTopic.includes('وضو') ||
        lowerTopic.includes('قرآن') ||
        lowerTopic.includes('معاد')
      ) {
        effectiveSubject = 'هدیه‌های آسمان'
      } else if (
        lowerTopic.includes('اجتماعی') ||
        lowerTopic.includes('تاریخ') ||
        lowerTopic.includes('جغرافیا') ||
        lowerTopic.includes('مدنی') ||
        lowerTopic.includes('ایران') ||
        lowerTopic.includes('اصفهان') ||
        lowerTopic.includes('صفویه') ||
        lowerTopic.includes('کشاورزی') ||
        lowerTopic.includes('انرژی فسیلی')
      ) {
        effectiveSubject = 'مطالعات اجتماعی'
      }

      if (!effectiveSubject) {
        effectiveSubject = 'پایه ششم ابتدایی'
      }

      const numCount = Math.min(25, Math.max(1, Number(count) || 5))

      const difficultyDesc =
        difficulty === 'hard'
          ? 'سطح دشوار و تحلیلی تیزهوشانی (مدارس سمپاد)'
          : difficulty === 'easy'
          ? 'سطح ساده و روان برای تثبیت مفاهیم کتاب درسی'
          : 'سطح استاندارد امتحانات کلاسی و نهایی پایه ششم'

      const prompt = `شما همان آموزگار شایسته، دلسوز، خوش‌قریحه و حرفه‌ای پایه ششم ابتدایی هستید که بهترین تکالیف، تمرین‌ها و کاربرگ‌های کلاسی را طراحی می‌کنید.
معلم از شما خواسته است برای این موضوع، یک آزمون بسیار باکیفیت، استاندارد، عینی و درست‌وحسابی طراحی کنید (دقیقاً با همان قلم گیرا، آموزشی، خلاقانه و ملموس بخش تکالیف و تمرین‌ها):
🎯 موضوع و مبحث دقیق: «${rawTopic}»
🎯 حوزه و درس مربوطه: «${effectiveSubject}»
${extraInstructions ? `🎯 توضیحات و دستورات معلم: «${extraInstructions}»` : ''}
📊 سطح دشواری: ${difficultyDesc}
🔢 تعداد کل سوالات: ${numCount} سوال
📝 انواع سوالات مورد نظر: ${Array.isArray(types) ? types.join('، ') : 'چهارگزینه‌ای، جای خالی، تشریحی'}

*** اصول کلیدی برای طراحی سوالات درست‌وحسابی و جذاب (دقیقاً مانند بخش تمرین‌ها): ***
۱. سوالات باید زنده، ملموس و دارای سناریو یا داده‌های واقعی باشند (مثل مسائل زندگی روزمره، خرید، تقسیم خوراکی، پارچه، شکل‌های دقیق هندسی، ابیات و اشعار اصیل فارسی، آزمایش‌های علمی ملموس).
۲. از هرگونه عبارت کلیشه‌ای، فرمول خشک، یا سوالات ماشینی بدون روح پرهیز کنید.
۳. سوالات را دقیقاً متناسب با درک و سن دانش‌آموزان ۱۲ ساله پایه ششم بنویسید.
۴. در سوالات چهارگزینه‌ای: ۴ گزینه ملموس، متمایز و حساب‌شده طراحی کنید (گزینه‌های گمراه‌کننده هوشمندانه باشند).
۵. در سوالات جای خالی: صورت سوال روان باشد و جای خالی با ............ مشخص شده باشد.
۶. در سوالات تشریحی یا حل مسئله: مسئله‌ای هدفمند که دانش‌آموز با نوشتن مراحل به پاسخ برسد.
۷. در پاسخنامه و راهنمای تصحیح (rubricOrHint): دقیقاً مانند پاسخنامه کاربرگ تمرینی، توضیح کامل، آموزنده و گام‌به‌گام راه‌حل را بنویسید تا معلم و دانش‌آموز از آن بیاموزند.

خروجی باید صرفاً یک آرایه JSON معتبر طبق این الگو باشد:
[
  {
    "id": "q1",
    "type": "multiple_choice",
    "question": "متن روان، ملموس و دقیق صورت سوال درباره موضوع",
    "options": ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"],
    "correctAnswer": 0,
    "rubricOrHint": "توضیح کامل، گام‌به‌گام و آموزنده پاسخنامه",
    "points": 2
  },
  {
    "id": "q2",
    "type": "fill_in_the_blank",
    "question": "متن روان سوال با علامت ............ برای جای خالی",
    "correctAnswer": "پاسخ دقیق جای خالی",
    "rubricOrHint": "توضیح گام‌به‌گام پاسخ",
    "points": 2
  },
  {
    "id": "q3",
    "type": "descriptive",
    "question": "مسئله یا سوال تشریحی مفهومی که نیازمند توضیح یا محاسبه گام‌به‌گام است",
    "rubricOrHint": "معیار نمره‌دهی و راه‌حل گام‌به‌گام",
    "points": 3
  }
]`

      const jsonText = await callGeminiWithFallbacks(prompt, true)
      let cleaned = jsonText.trim()
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim()
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim()

      const firstBracket = cleaned.indexOf('[')
      const lastBracket = cleaned.lastIndexOf(']')
      if (firstBracket !== -1 && lastBracket !== -1) {
        cleaned = cleaned.substring(firstBracket, lastBracket + 1)
      }

      const parsed = JSON.parse(cleaned)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('قالب بازگشتی هوش مصنوعی معتبر نبود.')
      }

      res.json({
        success: true,
        detectedSubject: effectiveSubject,
        questions: parsed,
      })
    } catch (err: any) {
      console.error('Error in generate-exam:', err)
      res.status(500).json({ success: false, error: err?.message || 'خطا در طراحی سوالات با هوش مصنوعی' })
    }
  })

  // --------------------------------------------------------------------------
  // CONVERT PRACTICE / HOMEWORK TEXT TO INTERACTIVE EXAM QUESTIONS
  // --------------------------------------------------------------------------
  app.post('/api/ai/convert-practice-to-exam', requireAiAuth, async (req, res) => {
    try {
      const { text, subject = 'پایه ششم' } = req.body
      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, error: 'متن تمرین یا کاربرگ ارسال نشده است.' })
      }

      const prompt = `شما دستیار هوشمند آموزگار پایه ششم هستید. متن کاربرگ تمرینی یا تکلیف زیر را تجزیه کرده و آن را به سوالات آزمون آنلاین استاندارد (آرایه JSON) تبدیل کنید.
اگر سوال چهارگزینه‌ای است به multiple_choice با ۴ گزینه و correctAnswer (شاخص عددی 0 تا 3) تبدیل کنید.
اگر جای خالی است به fill_in_the_blank با علامت ............ و correctAnswer مشخص تبدیل کنید.
اگر تشریحی، حل مسئله یا نیاز به توضیح است به descriptive تبدیل کنید.
اگر پاسخنامه در انتهای متن وجود دارد، پاسخ و استدلال هر سوال را در rubricOrHint قرار دهید.

متن تمرین/کاربرگ:
${text}

خروجی باید صرفاً یک آرایه JSON معتبر باشد:
[
  {
    "id": "q1",
    "type": "multiple_choice",
    "question": "صورت سوال",
    "options": ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"],
    "correctAnswer": 0,
    "rubricOrHint": "استدلال یا پاسخنامه",
    "points": 2
  }
]`

      const jsonText = await callGeminiWithFallbacks(prompt, true)
      let cleaned = jsonText.trim()
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim()
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim()

      const firstBracket = cleaned.indexOf('[')
      const lastBracket = cleaned.lastIndexOf(']')
      if (firstBracket !== -1 && lastBracket !== -1) {
        cleaned = cleaned.substring(firstBracket, lastBracket + 1)
      }

      const parsed = JSON.parse(cleaned)
      res.json({
        success: true,
        questions: parsed,
      })
    } catch (err: any) {
      console.error('Error in convert-practice-to-exam:', err)
      res.status(500).json({ success: false, error: err?.message || 'خطا در تبدیل تمرین به آزمون' })
    }
  })

  // --------------------------------------------------------------------------
  // AI PRACTICE WORKSHEET GENERATOR
  // --------------------------------------------------------------------------
  app.post('/api/ai/generate-practice', requireAiAuth, async (req, res) => {
    try {
      const { topic, count = 5, difficulty = 'medium' } = req.body
      const difficultyLabel = ({ easy: 'ساده', medium: 'متوسط', hard: 'سخت و تیزهوشانی' } as any)[difficulty] || 'متوسط'

      const prompt = `شما آموزگار شایسته، دلسوز و حرفه‌ای پایه ششم ابتدایی هستید.
موضوع و خواسته معلم برای تکلیف/تمرین: «${topic}»
سطح دشواری: ${difficultyLabel}
تعداد: ${count} سوال

دستورات حیاتی برای قالب‌بندی:
۱. هرگز و تحت هیچ شرایطی جواب، کلید سوال یا پاسخ درست را در صورت سوال یا بلافاصله پس از سوال ننویسید.
۲. صورت هر سوال باید کاملاً شفاف و تمیز باشد تا دانش‌آموز خود به تنهایی روی آن فکر کند و حل کند.
۳. در نگارش عبارات ریاضی:
   - علامت‌های کسر را به شکل کسری مشخص مانند ۳/۴ یا \\frac{۳}{۴} بنویسید.
   - ضرب را با علامت × و تقسیم را با ÷ یا کسر نمایش دهید.
۴. سوالات باید سناریودار، ملموس و مناسب سن ۱۲ سالگی باشند.
۵. پاسخنامه و راه‌حل گام‌به‌گام فقط و فقط در انتهای متن و پس از جداکننده «---» و با عنوان «📝 پاسخنامه و راهنمای حل تشریحی (ویژه معلم)» قرار گیرد.

ساختار کاربرگ:
- خط اول: عنوان شیک کاربرگ
- صورت سوالات شماره‌گذاری شده ۱ تا ${count}
- علامت جداکننده «---»
- پاسخنامه تشریحی گام‌به‌گام`

      const text = await callGeminiWithFallbacks(prompt, false)
      res.json({ success: true, text })
    } catch (err: any) {
      console.error('Error generating practice:', err)
      res.status(500).json({ success: false, error: err?.message || 'خطا در تولید تمرین' })
    }
  })

  // --------------------------------------------------------------------------
  // AI CLASSROOM DATA ASSISTANT (Chat with class performance data)
  // --------------------------------------------------------------------------
  app.post('/api/ai/classroom-chat', requireAiAuth, async (req, res) => {
    try {
      const { message, classroomContext } = req.body
      if (!message || !String(message).trim()) {
        return res.status(400).json({ success: false, error: 'متن پرسش یا پیام معلم مشخص نشده است.' })
      }

      const prompt = `شما یک دستیار هوشمند و مشاور ارشد پداگوژی و تحلیل داده‌های کلاس درس برای آموزگار پایه ششم ابتدایی هستید.
آموزگار درباره وضعیت تحصیلی، تکالیف و نمرات دانش‌آموزان با شما مشورت می‌کند.

داده‌های واقعی، مستند و به‌روز دریافتی از سامانه کلاس:
${JSON.stringify(classroomContext || {}, null, 2)}

پیام یا سوال آموزگار:
«${message}»

راهنمای پاسخ‌دهی شما:
۱. داده‌محور و دقیق باشید: اگر معلم درباره دانش‌آموزی (مثلاً علی، رضا و ...) سوال کرد، به تعداد تکالیف ارسالی و ارسال‌نشده او، میانگین نمراتش، دروس نقطه قوت و دروسی که در آن‌ها افت داشته یا نمره پایین گرفته، و وضعیت غیبت/تاخیر او استناد کنید.
۲. تمام نمرات را در مقیاس ۲۰ نمره تحلیل و بیان کنید (مثلاً نمره ۱۶ از ۲۰).
۳. تمامی اعداد و ارقام را حتماً به فارسی بنویسید (۰، ۱، ۲، ۳، ۴، ۵، ۶، ۷، ۸، ۹).
۴. علاوه بر بیان وضعیت، تحلیل روانشناختی-آموزشی و راهکارهای عملی (نظیر تکالیف جبرانی هدفمند، تشویق کلامی، جلسات رفع اشکال) به معلم پیشنهاد دهید.
۵. لحن شما صمیمی، دلسوزانه، محترمانه، منسجم و با ساختار بولت‌پوینت‌های خوانا و زیبا باشد.`

      const text = await callGeminiWithFallbacks(prompt, false)
      res.json({ success: true, reply: text })
    } catch (err: any) {
      console.error('Error in classroom-chat:', err)
      res.status(500).json({ success: false, error: err?.message || 'خطا در تحلیل هوش مصنوعی کلاس' })
    }
  })

  // --------------------------------------------------------------------------
  // AI PREVIEW SAMPLE
  // --------------------------------------------------------------------------
  app.post('/api/ai/preview', requireAiAuth, async (req, res) => {
    try {
      const { topic, difficulty = 'medium' } = req.body
      const prompt = `به عنوان طراح سوال پایه ششم، بر اساس این موضوع: «${topic}» و سطح «${difficulty}»، ۳ سوال نمونه واقعی و آموزنده طراحی کن. بین هر سوال فاصله بگذار. بدون حاشیه و پاسخنامه.`
      const text = await callGeminiWithFallbacks(prompt, false)
      res.json({ success: true, text })
    } catch (err: any) {
      console.error('Error in preview:', err)
      res.status(500).json({ success: false, error: err?.message || 'خطا در تولید پیش‌نمایش' })
    }
  })

  // --------------------------------------------------------------------------
  // AI ANNOUNCEMENT
  // --------------------------------------------------------------------------
  app.post('/api/ai/generate-announcement', requireAiAuth, async (req, res) => {
    try {
      const { topic } = req.body
      const prompt = `شما آموزگار مهربان و باانگیزه پایه ششم هستید. بر اساس یادداشت زیر، یک اطلاعیه کلاسی شاداب، رسمی، خوانا و منظم برای دانش‌آموزان و اولیا بنویسید:
«${topic}»
خط اول عنوان باشد و متن اعلان در ۲ الی ۴ بند مرتب.`

      const text = await callGeminiWithFallbacks(prompt, false)
      res.json({ success: true, text })
    } catch (err: any) {
      console.error('Error in announcement:', err)
      res.status(500).json({ success: false, error: err?.message || 'خطا در نگارش اعلان' })
    }
  })

  // --------------------------------------------------------------------------
  // AI SUBMISSION GRADING & TEACHER NOTE GENERATOR
  // --------------------------------------------------------------------------
  app.post('/api/ai/grade-submission', requireAiAuth, async (req, res) => {
    try {
      const { questions, studentName = 'دانش‌آموز', totalPoints = 20 } = req.body
      if (!Array.isArray(questions)) {
        return res.status(400).json({ error: 'questions array is required' })
      }

      const prompt = `شما آموزگار مهربان، دلسوز و باتجربه پایه ششم ابتدایی هستید. نام شما آموزگار کلاس است.
دانش‌آموز به نام «${studentName}» در این آزمون شرکت کرده است.
اطلاعات سوالات، بارم، راهنمای حل، و پاسخ ثبت‌شده دانش‌آموز:
${JSON.stringify(questions, null, 2)}

وظایف شما:
۱. برای هر سوال نمره منصفانه بر اساس پاسخ و بازخورد آموزنده بنویسید.
۲. یک «یادداشت معلمانه شخصی‌سازی‌شده و صمیمی» (teacherSummaryNote) مستقیماً با لحن آموزگار خطاب به دانش‌آموز بنویسید:
   - خطاب به دانش‌آموز با لحن مهربان و تشویقی
   - اشاره دقیق به نقاط قوتش در سوالاتی که خوب پاسخ داده
   - اشاره به مبحث یا سوالاتی که باید بیشتر روی آن‌ها تمرین و کار کند
   - کلام انگیزشی در پایان
   - لحن کاملاً طبیعی از زبان آموزگار باشد و هیچ اسمی از هوش مصنوعی یا سیستم خودکار برده نشود.

پاسخ را صرفاً به صورت یک آبجکت JSON معتبر با این ساختار برگردانید:
{
  "grades": [
    {
      "id": "شناسه سوال",
      "score": 2.5,
      "feedback": "بازخورد آموزنده به پاسخ سوال"
    }
  ],
  "teacherSummaryNote": "متن یادداشت و بازخورد جامع آموزگار به دانش‌آموز"
}`

      const jsonText = await callGeminiWithFallbacks(prompt, true)
      let cleaned = jsonText.trim()
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim()
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim()

      const parsed = JSON.parse(cleaned)
      const gradesArr = Array.isArray(parsed) ? parsed : (parsed.grades || [])
      const rawTeacherNote = Array.isArray(parsed) ? '' : (parsed.teacherSummaryNote || '')
      const cleanNote = sanitizeTeacherNote(rawTeacherNote)

      // Calculate total earned score and scale to 20 ($Score = (Earned / Total) * 20$)
      const totalEarned = gradesArr.reduce((sum: number, g: any) => sum + (Number(g.score) || 0), 0)
      const maxPts = Number(totalPoints) || 20
      const scaledScore20 = maxPts > 0 ? Math.round(((totalEarned / maxPts) * 20) * 10) / 10 : totalEarned

      res.json({
        success: true,
        grades: gradesArr,
        totalScore: totalEarned,
        maxScore: maxPts,
        scaledScore20,
        scale: 20,
        teacherSummaryNote: cleanNote,
      })

    } catch (err: any) {
      console.error('Error in grading submission:', err)
      res.status(500).json({ success: false, error: err?.message || 'خطا در بررسی پاسخ‌ها' })
    }
  })

  // --------------------------------------------------------------------------
  // VITE / STATIC SERVING
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(process.cwd(), 'dist')
    app.use(express.static(distPath))
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`)
  })
}

startServer().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
