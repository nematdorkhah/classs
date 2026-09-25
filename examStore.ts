import { Exam, ExamQuestion, StudentExamSubmission } from '../types/examTypes'
import { supabase } from '../supabaseClient'

const EXAMS_STORAGE_KEY = 'school_classroom_exams_v1'
const SUBMISSIONS_STORAGE_KEY = 'school_classroom_exam_subs_v1'

// ----------------------------------------------------------------------
// EXAM CRUD & PERSISTENCE
// ----------------------------------------------------------------------

export function getLocalExams(): Exam[] {
  try {
    const raw = localStorage.getItem(EXAMS_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to parse local exams', e)
    return []
  }
}

export function saveLocalExams(exams: Exam[]) {
  try {
    localStorage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(exams))
  } catch (e) {
    console.error('Failed to save local exams', e)
  }
}

export async function fetchAllExams(teacherPassword?: string): Promise<Exam[]> {
  const local = getLocalExams()
  try {
    // 1. Try server exams endpoint
    const res = await fetch('/api/exams?role=teacher')
    if (res.ok) {
      const data = await res.json()
      if (data.success && Array.isArray(data.exams) && data.exams.length > 0) {
        saveLocalExams(data.exams)
        return data.exams
      }
    }
  } catch (err) {
    console.warn('Could not sync with /api/exams, falling back to Supabase/local', err)
  }

  try {
    const { data: posts } = await supabase.from('posts').select('*').eq('type', 'exam')
    if (posts && posts.length > 0) {
      const mergedMap = new Map<string, Exam>()
      local.forEach((e) => mergedMap.set(e.id, e))
      posts.forEach((p: any) => {
        try {
          const parsed = JSON.parse(p.body)
          if (parsed && parsed.id) {
            mergedMap.set(parsed.id, parsed)
          }
        } catch {
          // ignore
        }
      })
      const merged = Array.from(mergedMap.values())
      saveLocalExams(merged)
      return merged
    }
  } catch (err) {
    console.warn('Could not sync exams with Supabase posts, using local copy', err)
  }
  return local
}

export function isPromptLike(text: string): boolean {
  if (!text) return false
  const promptPhrases = [
    'طراحی کن', 'بده', 'بساز', 'بنویس', 'سوال از', 'سوالات', 'پرامپت', 'هوش مصنوعی',
    'با جواب', 'تشریحی', 'چهارگزینه‌ای', 'سخت باشه', 'آسون باشه', 'در حد', 'برای دانش آموزان',
    'پایه ششم', 'برای امتحان', 'تعداد', 'گزینه دار', 'پاسخنامه', 'تست', 'آزمون از', 'آزمون بده'
  ]
  return promptPhrases.some((word) => text.includes(word)) || text.length > 45
}

export function sanitizeExamTitle(title: string, subject?: string): string {
  if (!title) return subject ? `آزمون ${subject}` : 'آزمون کلاسی'
  const fallback = subject ? `آزمون کلاسی ${subject}` : 'آزمون کلاسی پایه ششم'
  
  if (title.includes(' - ')) {
    const [mainPart, ...rest] = title.split(' - ')
    const subPart = rest.join(' - ')
    if (isPromptLike(subPart)) {
      return mainPart.trim() || fallback
    }
  }

  if (isPromptLike(title)) {
    return fallback
  }

  return title
}

export async function fetchPublishedExams(forStudent = true): Promise<Exam[]> {
  if (forStudent) {
    try {
      // SECURITY FIX: Request sanitized exams with answer keys stripped
      const res = await fetch('/api/exams?role=student')
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.exams)) {
          return data.exams
        }
      }
    } catch (err) {
      console.warn('Failed to fetch student exams from server, falling back to local sanitized', err)
    }
  }

  const all = await fetchAllExams()
  const published = all.filter((e) => e.published)
  if (forStudent) {
    // Client-side sanitization fallback
    return published.map((exam) => ({
      ...exam,
      questions: exam.questions.map((q) => {
        const { correctAnswer, rubricOrHint, ...safeQ } = q as any
        return safeQ as ExamQuestion
      }),
    }))
  }
  return published
}

export async function saveExam(exam: Exam, teacherPassword?: string): Promise<void> {
  const current = getLocalExams()
  const idx = current.findIndex((e) => e.id === exam.id)
  if (idx >= 0) {
    current[idx] = exam
  } else {
    current.unshift(exam)
  }
  saveLocalExams(current)

  try {
    await fetch('/api/exams/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exam, teacherPassword }),
    })
  } catch (e) {
    console.warn('Failed to sync exam to server /api/exams/save', e)
  }

  if (teacherPassword) {
    try {
      await supabase.rpc('teacher_create_post', {
        p_password: teacherPassword,
        p_type: 'exam',
        p_title: `📝 آزمون: ${exam.title} (${exam.subject})`,
        p_body: JSON.stringify(exam),
        p_due_at: new Date(new Date(exam.scheduledStartTime).getTime() + exam.durationMinutes * 60000).toISOString(),
        p_publish_at: new Date(exam.scheduledStartTime).toISOString(),
        p_attachment_path: null,
      })
    } catch (e) {
      console.warn('Supabase post sync for exam failed, local exam saved', e)
    }
  }
}

export function deleteExam(examId: string): void {
  const current = getLocalExams().filter((e) => e.id !== examId)
  saveLocalExams(current)

  fetch('/api/exams/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ examId }),
  }).catch((err) => console.warn('Failed to delete on server', err))
}

// ----------------------------------------------------------------------
// SUBMISSIONS & PERSISTENCE
// ----------------------------------------------------------------------

export function getLocalSubmissions(): StudentExamSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to parse local exam submissions', e)
    return []
  }
}

export function saveLocalSubmissions(subs: StudentExamSubmission[]) {
  try {
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(subs))
  } catch (e) {
    console.error('Failed to save local exam submissions', e)
  }
}

export async function fetchExamSubmissions(examId?: string, studentId?: string): Promise<StudentExamSubmission[]> {
  try {
    let url = '/api/exams/submissions'
    const params = new URLSearchParams()
    if (examId) params.append('examId', examId)
    if (studentId) params.append('studentId', studentId)
    if (params.toString()) url += `?${params.toString()}`

    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      if (data.success && Array.isArray(data.submissions)) {
        const local = getLocalSubmissions()
        const mergedMap = new Map<string, StudentExamSubmission>()
        local.forEach((s) => mergedMap.set(s.id, s))
        data.submissions.forEach((s: StudentExamSubmission) => mergedMap.set(s.id, s))
        const merged = Array.from(mergedMap.values())
        saveLocalSubmissions(merged)
        return examId ? merged.filter((s) => s.examId === examId) : merged
      }
    }
  } catch (err) {
    console.warn('Failed to fetch submissions from server', err)
  }
  const local = getLocalSubmissions()
  return examId ? local.filter((s) => s.examId === examId) : local
}

export function getExamSubmissions(examId: string): StudentExamSubmission[] {
  // Trigger background sync with server
  fetchExamSubmissions(examId).catch(() => {})
  return getLocalSubmissions().filter((s) => s.examId === examId)
}

export function getStudentExamSubmission(examId: string, studentId: string): StudentExamSubmission | undefined {
  return getLocalSubmissions().find((s) => s.examId === examId && s.studentId === studentId)
}

// ----------------------------------------------------------------------
// AI EXAM GENERATOR (Calls Server Backend Powered by Gemini 3.x Flash)
// ----------------------------------------------------------------------

export async function generateAiExamQuestions(params: {
  subject: string
  topic: string
  count: number
  types: ('multiple_choice' | 'fill_in_the_blank' | 'descriptive' | 'image')[]
  difficulty?: 'easy' | 'medium' | 'hard'
  extraInstructions?: string
}): Promise<ExamQuestion[]> {
  let lastError = ''
  
  // Try up to 2 attempts
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch('/api/ai/generate-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
          return data.questions.map((item: any, idx: number) => ({
            id: item.id || `q_${Date.now()}_${idx + 1}`,
            type: item.type || 'multiple_choice',
            question: item.question,
            options: item.options || (item.type === 'multiple_choice' ? ['الف', 'ب', 'ج', 'د'] : undefined),
            correctAnswer: item.correctAnswer ?? 0,
            rubricOrHint: item.rubricOrHint || '',
            points: Number(item.points) || 2,
          }))
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        lastError = errData.error || `خطای سرور (${res.status})`
        console.warn(`Attempt ${attempt} failed:`, lastError)
      }
    } catch (err: any) {
      lastError = err?.message || 'خطای شبکه در ارتباط با سرور'
      console.warn(`Attempt ${attempt} network error:`, lastError)
    }
  }

  // Never silently substitute a completely different topic! Throw real error so teacher is informed.
  throw new Error(
    lastError ||
      `هوش مصنوعی در حال حاضر نتوانست سوالات موضوع «${params.topic}» را آماده کند. لطفاً دوباره دکمه را بزنید.`
  )
}

export async function convertPracticeTextToQuestions(
  text: string,
  subject = 'پایه ششم'
): Promise<ExamQuestion[]> {
  const res = await fetch('/api/ai/convert-practice-to-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, subject }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'خطا در تبدیل تمرین به سوالات آزمون')
  }
  const data = await res.json()
  if (!data.success || !Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error('سوال معتبری از متن کاربرگ استخراج نشد.')
  }
  return data.questions.map((item: any, idx: number) => ({
    id: item.id || `q_${Date.now()}_${idx + 1}`,
    type: item.type || 'multiple_choice',
    question: item.question,
    options: item.options || (item.type === 'multiple_choice' ? ['الف', 'ب', 'ج', 'د'] : undefined),
    correctAnswer: item.correctAnswer ?? 0,
    rubricOrHint: item.rubricOrHint || '',
    points: Number(item.points) || 2,
  }))
}

// ----------------------------------------------------------------------
// AUTHENTIC CURRICULUM QUESTIONS (NEVER Generic Templates)
// ----------------------------------------------------------------------

function generateAuthenticCurriculumQuestions(
  subject: string,
  topic: string,
  count: number,
  types: ('multiple_choice' | 'fill_in_the_blank' | 'descriptive' | 'image')[]
): ExamQuestion[] {
  const isMath = subject.includes('ریاضی')
  const isPersian = subject.includes('فارسی')
  const isScience = subject.includes('علوم')
  const isTizhooshan = subject.includes('هوش') || subject.includes('تیزهوشان')
  const isSocial = subject.includes('اجتماعی')

  let questionBank: ExamQuestion[] = []

  if (isMath) {
    questionBank = [
      {
        id: `math_1_${Date.now()}`,
        type: 'multiple_choice',
        question: 'محیط یک دایره ۳۱/۴ سانتی‌متر است. مساحت این دایره چند سانتی‌متر مربع می‌باشد؟ (عدد پی = ۳/۱۴)',
        options: ['۲۵', '۵۰', '۷۸/۵', '۱۵۷'],
        correctAnswer: 2,
        rubricOrHint: 'قطر = ۳۱/۴ ÷ ۳/۱۴ = ۱۰ سانتی‌متر. شعاع = ۵ سانتی‌متر. مساحت = ۵ × ۵ × ۳/۱۴ = ۷۸/۵ سانتی‌متر مربع.',
        points: 2,
      },
      {
        id: `math_2_${Date.now()}`,
        type: 'fill_in_the_blank',
        question: 'اگر حاصل‌ضرب دو کسر مساوی با ۱ باشد، آن دو کسر ............ یکدیگر نامیده می‌شوند.',
        correctAnswer: 'معکوس',
        rubricOrHint: 'پاسخ صحیح: معکوس (مثلاً معکوس ۲/۳ برابر با ۳/۲ است).',
        points: 2,
      },
      {
        id: `math_3_${Date.now()}`,
        type: 'descriptive',
        question: 'علی ۲/۵ از کتاب داستانش را در روز اول و ۱/۳ از باقی‌مانده کتاب را در روز دوم خواند. چه کسری از کتاب هنوز خوانده نشده است؟ مراحل را گام‌به‌گام بنویسید.',
        rubricOrHint: 'باقی‌مانده روز اول: ۳/۵. مطالعه روز دوم: ۱/۳ × ۳/۵ = ۱/۵. کل مطالعه: ۲/۵ + ۱/۵ = ۳/۵. نخوانده: ۲/۵.',
        points: 3,
      },
      {
        id: `math_4_${Date.now()}`,
        type: 'image',
        question: 'شکل یک مربع به ضلع ۱۰ سانتی‌متر که درون آن یک دایره محاط شده است را رسم کنید. مساحت قسمت رنگی (فاصله بین مربع و دایره) را با راه‌حل روی کاغذ بنویسید و عکس آن را بارگذاری نمایید.',
        rubricOrHint: 'مساحت مربع = ۱۰۰. شعاع دایره = ۵، مساحت دایره = ۷۸/۵. قسمت رنگی = ۱۰۰ - ۷۸/۵ = ۲۱/۵ سانتی‌متر مربع.',
        points: 3,
      },
    ]
  } else if (isPersian) {
    questionBank = [
      {
        id: `fa_1_${Date.now()}`,
        type: 'multiple_choice',
        question: 'در بیت «ای مادر عزیز که جانم فدای تو / قربان مهربانی و لطف و صفای تو» کدام آرایه ادبی به کار رفته است؟',
        options: ['تشبیه', 'مراعات نظیر (تناسب)', 'مناظره', 'مبالغه'],
        correctAnswer: 1,
        rubricOrHint: 'بین واژه‌های مهربانی، لطف و صفا تناسب و مراعات نظیر وجود دارد.',
        points: 2,
      },
      {
        id: `fa_2_${Date.now()}`,
        type: 'fill_in_the_blank',
        question: 'در جمله «دانش‌آموزان کوشا شعر زیبایی را خواندند»، کلمه «شعر زیبایی» نقش ............ را در جمله دارد.',
        correctAnswer: 'مفعول',
        rubricOrHint: 'پاسخ صحیح: مفعول (نشانه «را» به همراه مفعول آمده است).',
        points: 2,
      },
      {
        id: `fa_3_${Date.now()}`,
        type: 'descriptive',
        question: 'مفهوم کنایی عبارت «دست و پنجه نرم کردن» را بیان کرده و با آن یک جمله پرمعنا و زیبا بنویسید.',
        rubricOrHint: 'معنی کنایی: مبارزه کردن، درگیر شدن با مشکلات و تلاش برای غلبه بر سختی‌ها.',
        points: 3,
      },
      {
        id: `fa_4_${Date.now()}`,
        type: 'image',
        question: 'یک بند انشای توصیفی در ۴ خط درباره «زیبایی‌های آفرینش در بهار» با خط خوش و رعایت علائم نگارشی بنویسید و تصویر آن را ارسال کنید.',
        rubricOrHint: 'رعایت بندنویسی، املا، خط زیبا، و کاربرد صحیح آرایه‌ها و علائم نگارشی.',
        points: 3,
      },
    ]
  } else if (isScience) {
    questionBank = [
      {
        id: `sci_1_${Date.now()}`,
        type: 'multiple_choice',
        question: 'کدام لایه از زمین در حالت خمیری قرار دارد و حرکت ورقه‌های سنگ‌کره روی آن صورت می‌پذیرد؟',
        options: ['پوسته', 'خمیرکره (استنوسفر)', 'هسته درونی', 'گوشته زیرین جامد'],
        correctAnswer: 1,
        rubricOrHint: 'خمیرکره بخش بالایی گوشته است که به صورت خمیری بوده و جریان همرفتی دارد.',
        points: 2,
      },
      {
        id: `sci_2_${Date.now()}`,
        type: 'fill_in_the_blank',
        question: 'مهم‌ترین عامل تولید زلزله، آزاد شدن ناگهانی انرژی ذخیره شده در اثر شکستن ............ زمین است.',
        correctAnswer: 'سنگ‌ها',
        rubricOrHint: 'پاسخ صحیح: سنگ‌ها یا گسل‌ها.',
        points: 2,
      },
      {
        id: `sci_3_${Date.now()}`,
        type: 'descriptive',
        question: 'تفاوت موج‌های لرزه‌ای اولیه (P) و ثانویه (S) را از نظر سرعت و توانایی عبور از مواد مایع شرح دهید.',
        rubricOrHint: 'موج P طولی و سریع‌تر است و از جامد و مایع می‌گذرد؛ موج S عرضی، کندتر و فقط از جامدات عبور می‌کند.',
        points: 3,
      },
      {
        id: `sci_4_${Date.now()}`,
        type: 'image',
        question: 'یک مدار الکتریکی ساده شامل کلید، لامپ و باتری رسم نموده و جهت جریان الکتریکی را با فلش مشخص کرده و تصویر آن را بفرستید.',
        rubricOrHint: 'رسم صحیح نماد باتری (+ و -)، کلید، لامپ و جهت جریان قراردادی از مثبت به منفی.',
        points: 3,
      },
    ]
  } else if (isTizhooshan) {
    questionBank = [
      {
        id: `tiz_1_${Date.now()}`,
        type: 'multiple_choice',
        question: 'در یک دنباله عددی: ۲، ۵، ۱۰، ۱۷، ۲۶، ... عدد بعدی کدام است؟',
        options: ['۳۵', '۳۷', '۳۹', '۴۱'],
        correctAnswer: 1,
        rubricOrHint: 'الگوی n^2 + 1 است: ۱+۱=۲، ۴+۱=۵، ۹+۱=۱۰، ۱۶+۱=۱۷، ۲۵+۱=۲۶، بعدی ۳۶+۱ = ۳۷.',
        points: 2,
      },
      {
        id: `tiz_2_${Date.now()}`,
        type: 'fill_in_the_blank',
        question: 'مجموع اعداد روی وجه‌های روبروی هم در یک تاس استاندارد همواره برابر با عدد ............ است.',
        correctAnswer: '۷',
        rubricOrHint: 'پاسخ صحیح: ۷ (۱ با ۶، ۲ با ۵، ۳ با ۴).',
        points: 2,
      },
      {
        id: `tiz_3_${Date.now()}`,
        type: 'descriptive',
        question: 'اگر ۶ زنگوله در ساعت ۱۲ به مدت ۲۵ ثانیه نواخته شوند، برای نواختن ۴ زنگوله در ساعت دیگری چند ثانیه زمان لازم است؟ با دلیل توضیح دهید.',
        rubricOrHint: 'بین ۶ زنگوله، ۵ فاصله زمانی وجود دارد: ۲۵ ÷ ۵ = ۵ ثانیه هر فاصله. برای ۴ زنگوله ۳ فاصله نیاز است: ۳ × ۵ = ۱۵ ثانیه.',
        points: 3,
      },
      {
        id: `tiz_4_${Date.now()}`,
        type: 'image',
        question: 'گسترده یک مکعب را که دو وجه مجاور آن هاشور خورده روی کاغذ رسم کرده و تصویر آن را بارگذاری نمایید.',
        rubricOrHint: 'رسم ۶ مربع پیوسته با ساختار مکعبی صحیح و عدم تداخل وجوه.',
        points: 3,
      },
    ]
  } else {
    // General 6th grade questions
    questionBank = [
      {
        id: `gen_1_${Date.now()}`,
        type: 'multiple_choice',
        question: 'در تصمیم‌گیری‌های مهم و انتخاب‌های فردی، اولین گام منطقی چیست؟',
        options: ['پرسیدن نظر دیگران', 'فکر کردن درباره موضوع و گزینه‌های موجود', 'پیش‌بینی نتایج بد', 'انتخاب سریع‌ترین راه‌حل'],
        correctAnswer: 1,
        rubricOrHint: 'شناخت مسئله و تامل اولیه بر روی گزینه‌ها پایه تصمیم‌گیری صحیح است.',
        points: 2,
      },
      {
        id: `gen_2_${Date.now()}`,
        type: 'fill_in_the_blank',
        question: 'بزرگترین منبع انرژی پاک و تجدیدپذیر کره زمین که حیات موجودات به آن وابسته است انرژی ............ می‌باشد.',
        correctAnswer: 'خورشید',
        rubricOrHint: 'پاسخ صحیح: خورشید (یا انرژی خورشیدی).',
        points: 2,
      },
      {
        id: `gen_3_${Date.now()}`,
        type: 'descriptive',
        question: 'سه نمونه از فواید مصرف بهینه انرژی و راه‌های جلوگیری از اتلاف آن در خانه را نام ببرید.',
        rubricOrHint: 'عایق‌بندی پنجره‌ها، خاموش کردن لامپ‌های غیرضروری، تنظیم دمای بخاری.',
        points: 3,
      },
      {
        id: `gen_4_${Date.now()}`,
        type: 'image',
        question: 'نقشه ساده‌ای از مسیر خانه تا مدرسه رسم کرده و جهت‌های جغرافیایی اصلی را روی آن علامت بزنید و عکس بفرستید.',
        rubricOrHint: 'رسم تمیز مسیر، نشانگر شمال، جنوب، شرق و غرب.',
        points: 3,
      },
    ]
  }

  // Filter or match requested types
  const filtered = questionBank.filter((q) => types.includes(q.type))
  const pool = filtered.length > 0 ? filtered : questionBank

  const result: ExamQuestion[] = []
  for (let i = 0; i < count; i++) {
    const template = pool[i % pool.length]
    result.push({
      ...template,
      id: `q_${Date.now()}_${i + 1}`,
      points: template.points || 2,
    })
  }

  return result
}

// ----------------------------------------------------------------------
// AI EXAM GRADING (Deterministic + Generative evaluation)
// ----------------------------------------------------------------------

export async function gradeExamWithAI(
  exam: Exam,
  answers: Record<string, any>,
  studentName = 'دانش‌آموز'
): Promise<StudentExamSubmission['aiGrading']> {
  const questionScores: Record<string, number> = {}
  const questionFeedbacks: Record<string, string> = {}
  let totalScore = 0
  let serverTeacherNote = ''

  const complexQuestionsToGrade: { q: ExamQuestion; ans: any }[] = []

  for (const q of exam.questions) {
    const studentAns = answers[q.id]
    if (!studentAns) {
      questionScores[q.id] = 0
      questionFeedbacks[q.id] = 'دانش‌آموز به این سوال پاسخی نداده است.'
      continue
    }

    if (q.type === 'multiple_choice') {
      const selected = studentAns.selectedOption
      const isCorrect = Number(selected) === Number(q.correctAnswer)
      const score = isCorrect ? q.points : 0
      questionScores[q.id] = score
      totalScore += score
      questionFeedbacks[q.id] = isCorrect
        ? `✅ پاسخ صحیح است. (+${score} نمره)`
        : `❌ پاسخ نادرست است. گزینه درست: ${
            q.options ? q.options[Number(q.correctAnswer)] || `گزینه ${Number(q.correctAnswer) + 1}` : q.correctAnswer
          }`
    } else {
      complexQuestionsToGrade.push({ q, ans: studentAns })
    }
  }

  // Include all questions context for the personalized teacher note
  const allQuestionsData = exam.questions.map((q) => {
    const ans = answers[q.id]
    let stAns = 'بدون پاسخ'
    if (ans) {
      if (q.type === 'multiple_choice') {
        stAns = `گزینه انتخابی: ${Number(ans.selectedOption) + 1} (${q.options?.[ans.selectedOption] || ''}) - کلید صحیح: ${Number(q.correctAnswer) + 1}`
      } else {
        stAns = ans.textAnswer || (ans.imageAttachment ? '[تصویر برگه ارسال شده]' : 'بدون پاسخ')
      }
    }
    return {
      id: q.id,
      type: q.type,
      question: q.question,
      points: q.points,
      rubric: q.rubricOrHint,
      studentAnswer: stAns,
    }
  })

  try {
    const res = await fetch('/api/ai/grade-submission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questions: allQuestionsData,
        studentName,
        totalPoints: exam.totalPoints,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.teacherSummaryNote) {
        serverTeacherNote = data.teacherSummaryNote
      }
      if (data.success && Array.isArray(data.grades)) {
        for (const item of data.grades) {
          const matchingQ = exam.questions.find((q) => q.id === item.id)
          if (matchingQ && matchingQ.type !== 'multiple_choice') {
            const maxPts = matchingQ.points || 2
            const assignedScore = Math.min(maxPts, Math.max(0, Number(item.score) || 0))
            questionScores[item.id] = assignedScore
            questionFeedbacks[item.id] = item.feedback || `نمره پیشنهادی: ${assignedScore} از ${maxPts}`
            totalScore += assignedScore
          }
        }
      }
    }
  } catch (e) {
    console.warn('Backend grading request failed, using heuristic evaluation', e)
  }

  // Fallback for complex questions if server did not score them
  for (const { q, ans } of complexQuestionsToGrade) {
    if (questionScores[q.id] === undefined) {
      const text = (ans.textAnswer || '').trim()
      const hasAttachment = Boolean(ans.imageAttachment)
      let earned = 0
      let fb = ''

      if (q.type === 'fill_in_the_blank') {
        const expected = String(q.correctAnswer || '').trim().toLowerCase()
        if (text.toLowerCase() === expected || (expected && text.includes(expected))) {
          earned = q.points
          fb = '✅ پاسخ جای خالی کاملاً صحیح است.'
        } else if (text.length > 0) {
          earned = Math.round(q.points * 0.5 * 10) / 10
          fb = `پاسخ نزدیک است. پاسخ مورد انتظار: ${q.correctAnswer}`
        } else {
          fb = `پاسخ نادرست. پاسخ صحیح: ${q.correctAnswer}`
        }
      } else {
        if (text.length > 25 || hasAttachment) {
          earned = Math.round(q.points * 0.85 * 10) / 10
          fb = 'پاسخ کامل یا راه حل ثبت شده است.'
        } else if (text.length > 0) {
          earned = Math.round(q.points * 0.5 * 10) / 10
          fb = 'پاسخ مختصر درج شده است.'
        } else {
          fb = 'پاسخی ثبت نشده است.'
        }
      }

      questionScores[q.id] = earned
      questionFeedbacks[q.id] = fb
      totalScore += earned
    }
  }

  // Generate fallback teacher note if server note wasn't returned
  if (!serverTeacherNote) {
    const ratio = totalScore / (exam.totalPoints || 20)
    if (ratio >= 0.85) {
      serverTeacherNote = `آفرین ${studentName} عزیزم! عملکردت در این آزمون بسیار عالی و چشم‌گیر بود و تسلط خوبی روی مفاهیم نشان دادی. همین مسیر باانگیزه را ادامه بده.`
    } else if (ratio >= 0.6) {
      serverTeacherNote = `خسته نباشی ${studentName} جان؛ تلاشت در آزمون خوب بود. در سوالات تشریحی و نکته‌دار کمی بیشتر دقت کن تا در آزمون‌های بعدی نمره کامل را به دست آوری.`
    } else {
      serverTeacherNote = `${studentName} عزیز، خسته نباشی. نیاز است مباحث این درس را مجدداً با دقت مرور کنی و روی تمرین‌های کاربرگ کار کنی تا نقاط ضعف به نقطه قوت تبدیل شوند.`
    }
  }

  return {
    questionScores,
    questionFeedbacks,
    totalScore: Math.round(totalScore * 10) / 10,
    gradedAt: new Date().toISOString(),
    summary: serverTeacherNote,
  }
}

// ----------------------------------------------------------------------
// SUBMIT EXAM WORKFLOW
// ----------------------------------------------------------------------

export async function submitStudentExam(params: {
  exam: Exam
  studentId: string
  studentName: string
  answers: Record<string, any>
}): Promise<StudentExamSubmission> {
  const { exam, studentId, studentName, answers } = params

  try {
    const res = await fetch('/api/exams/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examId: exam.id,
        studentId,
        studentName,
        answers,
        clientExam: exam,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.success && data.submission) {
        const sub = data.submission as StudentExamSubmission
        const all = getLocalSubmissions().filter((s) => !(s.examId === exam.id && s.studentId === studentId))
        all.push(sub)
        saveLocalSubmissions(all)
        return sub
      }
    }
  } catch (err) {
    console.warn('Server submission failed, falling back to local grading', err)
  }

  const aiGrading = await gradeExamWithAI(exam, answers, studentName)

  const submission: StudentExamSubmission = {
    id: `sub_${exam.id}_${studentId}_${Date.now()}`,
    examId: exam.id,
    studentId,
    studentName,
    submittedAt: new Date().toISOString(),
    answers,
    aiGrading,
    teacherGrading: {
      approved: false,
      questionScores: aiGrading ? { ...aiGrading.questionScores } : {},
      questionFeedbacks: aiGrading ? { ...aiGrading.questionFeedbacks } : {},
      totalScore: aiGrading?.totalScore ?? 0,
      teacherNotes: aiGrading?.summary || '',
    },
  }

  const all = getLocalSubmissions().filter((s) => !(s.examId === exam.id && s.studentId === studentId))
  all.push(submission)
  saveLocalSubmissions(all)

  return submission
}

// ----------------------------------------------------------------------
// TEACHER APPROVAL & GRADEBOOK RECORDING
// ----------------------------------------------------------------------

export async function approveExamSubmission(params: {
  submissionId: string
  exam: Exam
  studentId: string
  approvedScores: Record<string, number>
  teacherNotes?: string
  teacherPassword?: string
}): Promise<StudentExamSubmission> {
  const { submissionId, exam, studentId, approvedScores, teacherNotes, teacherPassword } = params

  try {
    await fetch('/api/exams/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId,
        approvedScores,
        teacherNotes,
        teacherPassword,
      }),
    })
  } catch (e) {
    console.warn('Failed to sync approval to server', e)
  }

  const all = getLocalSubmissions()
  const sub = all.find((s) => s.id === submissionId)
  if (!sub) throw new Error('پاسخ آزمون یافت نشد.')

  let totalScore = 0
  for (const q of exam.questions) {
    totalScore += approvedScores[q.id] ?? (sub.aiGrading?.questionScores[q.id] || 0)
  }
  totalScore = Math.round(totalScore * 10) / 10

  sub.teacherGrading = {
    approved: true,
    questionScores: approvedScores,
    questionFeedbacks: sub.teacherGrading?.questionFeedbacks,
    teacherNotes: teacherNotes || 'تایید شده توسط آموزگار محترم',
    totalScore,
    approvedAt: new Date().toISOString(),
  }

  saveLocalSubmissions(all)

  if (teacherPassword) {
    try {
      await supabase.rpc('teacher_add_grade', {
        p_password: teacherPassword,
        p_student_id: studentId,
        p_subject: exam.subject || 'عمومی',
        p_skill: `آزمون: ${sanitizeExamTitle(exam.title, exam.subject)}`,
        p_score: totalScore,
        p_max_score: exam.totalPoints || 20,
      })
    } catch (e) {
      console.warn('Could not record grade to Supabase gradebook', e)
    }
  }

  return sub
}

// ----------------------------------------------------------------------
// BACKUP & RESTORE UTILITIES
// ----------------------------------------------------------------------

export interface SystemBackupData {
  version: string
  exportedAt: string
  exams: Exam[]
  examSubmissions: StudentExamSubmission[]
  tizhooshanProgress?: Record<string, any>
  students?: any[]
  posts?: any[]
  grades?: any[]
  attendance?: any[]
  submissions?: any[]
}

export async function exportCompleteSystemBackup(teacherPassword?: string): Promise<string> {
  const exams = getLocalExams()
  const examSubmissions = getLocalSubmissions()

  let students: any[] = []
  let posts: any[] = []
  let grades: any[] = []
  let attendance: any[] = []
  let submissions: any[] = []
  let tizhooshanProgress: any = {}

  try {
    const res = await fetch('/api/tizhooshan/all-progress')
    if (res.ok) {
      const d = await res.json()
      if (d.progressMap) tizhooshanProgress = d.progressMap
    }
  } catch (e) {
    console.warn('Failed to export server tizhooshan progress', e)
  }

  if (teacherPassword) {
    try {
      const [sRes, pRes, gRes, aRes, subRes] = await Promise.all([
        supabase.rpc('teacher_list_students', { p_password: teacherPassword }),
        supabase.rpc('teacher_list_posts', { p_password: teacherPassword }),
        supabase.rpc('teacher_list_grades', { p_password: teacherPassword }),
        supabase.rpc('teacher_list_attendance', { p_password: teacherPassword }),
        supabase.rpc('teacher_list_submissions', { p_password: teacherPassword }),
      ])
      students = sRes.data || []
      posts = pRes.data || []
      grades = gRes.data || []
      attendance = aRes.data || []
      submissions = subRes.data || []
    } catch (e) {
      console.warn('Failed to fetch some cloud tables during backup, including local data', e)
    }
  }

  const backup: SystemBackupData = {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    exams,
    examSubmissions,
    tizhooshanProgress,
    students,
    posts,
    grades,
    attendance,
    submissions,
  }

  return JSON.stringify(backup, null, 2)
}

export function downloadBackupFile(jsonString: string, filename = `school_backup_${new Date().toISOString().slice(0, 10)}.json`) {
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function restoreSystemBackup(backupJson: string): Promise<{ success: boolean; message: string }> {
  try {
    const data: SystemBackupData = JSON.parse(backupJson)
    if (!data || typeof data !== 'object') {
      throw new Error('فرمت فایل پشتیبان نامعتبر است.')
    }

    // 1. Sync to server persistent storage
    try {
      await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: data }),
      })
    } catch (e) {
      console.warn('Server restore sync failed', e)
    }

    // 2. Sync to local storage
    if (Array.isArray(data.exams)) {
      saveLocalExams(data.exams)
    }
    if (Array.isArray(data.examSubmissions)) {
      saveLocalSubmissions(data.examSubmissions)
    }
    if (data.tizhooshanProgress && typeof data.tizhooshanProgress === 'object') {
      localStorage.setItem('tizhooshan_class_progress', JSON.stringify(data.tizhooshanProgress))
    }
    if (Array.isArray(data.students) && data.students.length > 0) {
      localStorage.setItem('backup_students_cache', JSON.stringify(data.students))
    }
    if (Array.isArray(data.grades) && data.grades.length > 0) {
      localStorage.setItem('backup_grades_cache', JSON.stringify(data.grades))
    }
    if (Array.isArray(data.attendance) && data.attendance.length > 0) {
      localStorage.setItem('backup_attendance_cache', JSON.stringify(data.attendance))
    }
    if (Array.isArray(data.submissions) && data.submissions.length > 0) {
      localStorage.setItem('backup_submissions_cache', JSON.stringify(data.submissions))
    }
    if (Array.isArray(data.posts) && data.posts.length > 0) {
      localStorage.setItem('backup_posts_cache', JSON.stringify(data.posts))
    }

    const sections: string[] = []
    if (data.exams?.length) sections.push(`${data.exams.length} آزمون`)
    if (data.examSubmissions?.length) sections.push(`${data.examSubmissions.length} پاسخ آزمون`)
    if (data.students?.length) sections.push(`${data.students.length} دانش‌آموز`)
    if (data.grades?.length) sections.push(`${data.grades.length} نمره`)
    if (data.attendance?.length) sections.push(`${data.attendance.length} حضور و غیاب`)
    if (data.submissions?.length) sections.push(`${data.submissions.length} تکلیف`)

    return {
      success: true,
      message: `اطلاعات با موفقیت در کلیه بخش‌های سیستم و سرور بازیابی شد (${sections.join('، ')}).`,
    }
  } catch (err: any) {
    return {
      success: false,
      message: 'خطا در بازیابی اطلاعات: ' + err.message,
    }
  }
}
