export type QuestionType = 'multiple_choice' | 'fill_in_the_blank' | 'descriptive' | 'image'

export interface ExamQuestion {
  id: string
  type: QuestionType
  question: string
  options?: string[] // For multiple_choice (usually 4 options)
  correctAnswer?: string | number // Correct option index (0-3) or expected blank/keyword
  rubricOrHint?: string // Explanation/answer key for AI and grading
  points: number
  imageUrl?: string // Optional image for question
}

export interface Exam {
  id: string
  title: string
  subject: string
  description?: string
  scheduledStartTime: string // ISO string or format e.g. "2026-09-23T10:00:00"
  durationMinutes: number
  questions: ExamQuestion[]
  totalPoints: number
  createdAt: string
  published: boolean
  teacherPassword?: string
  mode?: 'exam' | 'assignment' // 'exam' = timed test, 'assignment' = interactive homework with multi-day open window
  isUntimed?: boolean // If true, runs without timer countdown stress
  dueDate?: string // Optional deadline for interactive assignment
}

export interface StudentExamAnswer {
  selectedOption?: number
  textAnswer?: string
  imageAttachment?: string
}

export interface StudentExamSubmission {
  id: string
  examId: string
  studentId: string
  studentName: string
  submittedAt: string
  answers: Record<string, StudentExamAnswer>
  aiGrading?: {
    questionScores: Record<string, number>
    questionFeedbacks: Record<string, string>
    totalScore: number
    gradedAt: string
    summary: string
  }
  teacherGrading?: {
    approved: boolean
    questionScores: Record<string, number>
    questionFeedbacks?: Record<string, string>
    teacherNotes?: string
    totalScore: number
    approvedAt?: string
  }
}
