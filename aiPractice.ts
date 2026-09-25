// Full-stack AI client proxying to backend /api/ai endpoints

export async function generatePractice({
  topic,
  count,
  difficulty,
}: {
  topic: string
  count: number | string
  difficulty: string
  bookUrl?: string | null
}): Promise<string> {
  const res = await fetch('/api/ai/generate-practice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, count, difficulty }),
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || 'خطا در ارتباط با سرور هوش مصنوعی')
  }
  const data = await res.json()
  return data.text || ''
}

export async function generateSamplePreview({
  topic,
  difficulty,
}: {
  topic: string
  difficulty: string
  bookUrl?: string | null
}): Promise<string> {
  const res = await fetch('/api/ai/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, difficulty }),
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || 'خطا در دریافت پیش‌نمایش')
  }
  const data = await res.json()
  return data.text || ''
}

export async function generateAnnouncement({ topic }: { topic: string }): Promise<string> {
  const res = await fetch('/api/ai/generate-announcement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || 'خطا در نگارش متن اعلان')
  }
  const data = await res.json()
  return data.text || ''
}

export async function generateInteractiveQuiz({
  topic,
  count = 5,
  subject = 'ریاضی',
}: {
  topic: string
  count?: number
  subject?: string
}): Promise<any> {
  const res = await fetch('/api/ai/generate-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject,
      topic,
      count,
      types: ['multiple_choice'],
    }),
  })
  if (res.ok) {
    const data = await res.json()
    if (data.questions) {
      return {
        title: `آزمونک ${subject}: ${topic}`,
        questions: data.questions.map((q: any, i: number) => ({
          id: i + 1,
          question: q.question,
          options: q.options || [],
          correctIndex: q.correctAnswer ?? 0,
        })),
      }
    }
  }
  throw new Error('خطا در تولید آزمونک')
}

export async function generateSampadAiQuestion({
  topic = 'استعداد تحلیلی و معماهای منطقی',
  difficulty = 'متوسط',
}: {
  topic?: string
  difficulty?: 'آسان' | 'متوسط' | 'سخت'
}): Promise<{
  id: number
  question: string
  options: string[]
  correct_index: number
  explanation: string
  difficulty: 'آسان' | 'متوسط' | 'سخت'
  xp: number
}> {
  const diffEng = difficulty === 'سخت' ? 'hard' : difficulty === 'آسان' ? 'easy' : 'medium'
  const res = await fetch('/api/ai/generate-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: 'هوش و استعداد تحلیلی (تیزهوشان)',
      topic,
      count: 1,
      types: ['multiple_choice'],
      difficulty: diffEng,
      extraInstructions: 'یک سوال استاندارد با تکنیک استدلال آزمون تیزهوشان بساز.',
    }),
  })
  if (res.ok) {
    const data = await res.json()
    if (data.questions && data.questions[0]) {
      const q = data.questions[0]
      return {
        id: Date.now() + Math.floor(Math.random() * 1000),
        question: q.question,
        options: q.options || ['گزینه ۱', 'گزینه ۲', 'گزینه ۳', 'گزینه ۴'],
        correct_index: Number(q.correctAnswer) || 0,
        explanation: q.rubricOrHint || 'پاسخ صحیح گزینه فوق است.',
        difficulty,
        xp: difficulty === 'آسان' ? 15 : difficulty === 'متوسط' ? 25 : 35,
      }
    }
  }
  throw new Error('تولید سوال هوشمند انجام نشد.')
}
