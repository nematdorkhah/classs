import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function OnlineQuizModal({
  quiz,
  student,
  onClose,
  onFinish,
}: {
  quiz: any
  student: any
  onClose: () => void
  onFinish: () => void
}) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resultScore, setResultScore] = useState<number | null>(null)

  const questions = quiz.questions || []
  const currentQ = questions[currentIdx]

  function handleSelect(optIdx: number) {
    setSelectedAnswers({ ...selectedAnswers, [currentIdx]: optIdx })
  }

  async function handleFinish() {
    setIsSubmitting(true)
    let correctCount = 0
    questions.forEach((q: any, idx: number) => {
      if (selectedAnswers[idx] === q.correctIndex) correctCount++
    })

    const finalScore = Number(((correctCount / (questions.length || 1)) * 20).toFixed(2))

    try {
      const { error } = await supabase.rpc('submit_quiz_attempt', {
        p_student_id: student.id,
        p_access_code: student.access_code,
        p_quiz_id: quiz.id,
        p_answers: selectedAnswers,
        p_score: finalScore,
      })

      if (error) {
        console.warn('Could not record quiz via RPC, showing score locally:', error.message)
      }
    } catch (e) {
      console.warn('Error during quiz attempt RPC:', e)
    }

    setIsSubmitting(false)
    setResultScore(finalScore)
  }

  if (resultScore !== null) {
    return (
      <div className="viewer-backdrop">
        <div className="auth-card hard" style={{ textAlign: 'center' }}>
          <h2>🎉 پایان آزمون</h2>
          <p>نمره شما ثبت شد:</p>
          <div style={{ fontSize: 44, fontWeight: 900, color: 'var(--red)', margin: '14px 0' }}>
            {resultScore} <span style={{ fontSize: 18, color: '#64748b' }}>/ ۲۰</span>
          </div>
          <button
            className="btn"
            type="button"
            onClick={() => {
              onFinish()
              onClose()
            }}
          >
            متوجه شدم
          </button>
        </div>
      </div>
    )
  }

  if (!currentQ) return null

  return (
    <div className="viewer-backdrop">
      <div className="auth-card hard" style={{ maxWidth: 520, width: '95%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#6b6459' }}>
            سوال {currentIdx + 1} از {questions.length}
          </span>
          <button className="link" onClick={onClose} style={{ color: 'var(--red)' }}>انصراف</button>
        </div>

        <div style={{ background: '#eee', height: 6, borderRadius: 10, marginBottom: 18, overflow: 'hidden' }}>
          <div
            style={{
              background: 'var(--red)',
              height: '100%',
              width: `${((currentIdx + 1) / questions.length) * 100}%`,
              transition: 'width 0.2s ease',
            }}
          />
        </div>

        <h3 style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 16 }}>{currentQ.question}</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {currentQ.options?.map((opt: string, i: number) => {
            const isSelected = selectedAnswers[currentIdx] === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(i)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: isSelected ? '2px solid var(--red)' : '2px solid var(--black)',
                  background: isSelected ? '#fee2e2' : '#fff',
                  textAlign: 'right',
                  fontSize: 14,
                  fontWeight: isSelected ? 800 : 500,
                  color: 'var(--black)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isSelected ? 'var(--red)' : '#eee',
                    color: isSelected ? '#fff' : 'var(--black)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {['الف', 'ب', 'ج', 'د'][i] || i + 1}
                </span>
                {opt}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
          <button
            className="btn secondary"
            style={{ width: 'auto', padding: '8px 16px' }}
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(currentIdx - 1)}
          >
            قبلی
          </button>

          {currentIdx < questions.length - 1 ? (
            <button
              className="btn"
              style={{ width: 'auto', padding: '8px 20px' }}
              disabled={selectedAnswers[currentIdx] === undefined}
              onClick={() => setCurrentIdx(currentIdx + 1)}
            >
              بعدی
            </button>
          ) : (
            <button
              className="btn"
              style={{ width: 'auto', padding: '8px 20px', background: 'var(--green)', color: '#fff' }}
              disabled={selectedAnswers[currentIdx] === undefined || isSubmitting}
              onClick={handleFinish}
            >
              {isSubmitting ? 'در حال ثبت...' : '✅ پایان آزمون'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
