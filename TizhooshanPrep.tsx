import { useState, useEffect, useMemo, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { supabase } from '../supabaseClient'
import {
  tizhooshanChaptersData,
  tizhooshanTopicsData,
  TizhooshanTopic,
  TizhooshanQuestion,
} from '../data/tizhooshanQuestions'
import { generateRandomTizhooshanQuestion } from '../data/endlessGenerator'

interface UserProgress {
  totalXp: number
  gems: number
  streak: number
  hearts: number
  lastActiveDate: string
  unlockedTopicIndex: number
  completedTopics: Record<string, { stars: number; xpEarned: number; completedAt: string }>
  completedQuestionIds: number[]
  openedChests: string[]
  wrongQuestionIds?: number[]
  dailyMultiplier?: number
  dailyMultiplierDate?: string
}

const STORAGE_KEY_PREFIX = 'tizhooshan_duolingo_'

function playSound(type: 'correct' | 'wrong' | 'complete' | 'click' | 'combo' | 'lifeline' | 'chest') {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()

    if (type === 'correct') {
      const now = ctx.currentTime
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.type = 'triangle'
      osc2.type = 'sine'

      osc1.frequency.setValueAtTime(587.33, now) // D5
      osc1.frequency.setValueAtTime(880, now + 0.08) // A5

      osc2.frequency.setValueAtTime(440, now) // A4
      osc2.frequency.setValueAtTime(659.25, now + 0.08) // E5

      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.35)
      osc2.stop(now + 0.35)
    } else if (type === 'chest') {
      const now = ctx.currentTime
      const notes = [440, 554.37, 659.25, 880, 1108.73]
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const time = now + idx * 0.08
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, time)
        gain.gain.setValueAtTime(0.14, time)
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(time)
        osc.stop(time + 0.3)
      })
    } else if (type === 'combo') {
      const now = ctx.currentTime
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51] // C, E, G, C6, E6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const time = now + idx * 0.07

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, time)
        gain.gain.setValueAtTime(0.15, time)
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(time)
        osc.stop(time + 0.25)
      })
    } else if (type === 'wrong') {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, now)
      osc.frequency.linearRampToValueAtTime(130, now + 0.25)

      gain.gain.setValueAtTime(0.1, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.28)
    } else if (type === 'complete') {
      const now = ctx.currentTime
      const notes = [523.25, 659.25, 783.99, 1046.5, 1174.66, 1318.51]
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const time = now + idx * 0.09

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, time)
        gain.gain.setValueAtTime(0.15, time)
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(time)
        osc.stop(time + 0.35)
      })
    } else if (type === 'lifeline') {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, now)
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.15)
      gain.gain.setValueAtTime(0.09, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.18)
    } else if (type === 'click') {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600, now)
      gain.gain.setValueAtTime(0.04, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.05)
    }
  } catch (e) {
    // Audio context may be restricted by autoplay policy
  }
}

function triggerConfetti() {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#22C55E', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6'],
    })
  } catch (e) {
    // Ignore if not supported
  }
}

interface ChapterChest {
  id: string
  chapterId: number
  afterStepIndex: number
  label: string
  gems: number
  hearts: number
}

// Milestone Treasure Chests per chapter
const CHAPTER_CHESTS: ChapterChest[] = [
  // Chapter 1: 22 steps
  { id: 'ch1-chest-1', chapterId: 1, afterStepIndex: 3, label: 'صندوقچه واژگان اصیل 🎁', gems: 30, hearts: 2 },
  { id: 'ch1-chest-2', chapterId: 1, afterStepIndex: 9, label: 'صندوقچه کنایات و امثال 🎁', gems: 45, hearts: 3 },
  { id: 'ch1-chest-3', chapterId: 1, afterStepIndex: 16, label: 'صندوقچه شاهنامه و متون 🎁', gems: 60, hearts: 5 },
  // Chapter 2: 21 steps
  { id: 'ch2-chest-1', chapterId: 2, afterStepIndex: 4, label: 'صندوقچه الگوهای عددی 🎁', gems: 35, hearts: 2 },
  { id: 'ch2-chest-2', chapterId: 2, afterStepIndex: 10, label: 'صندوقچه طلسم جایگشت 🎁', gems: 50, hearts: 3 },
  { id: 'ch2-chest-3', chapterId: 2, afterStepIndex: 17, label: 'صندوقچه مربع‌های جادویی 🎁', gems: 65, hearts: 5 },
  // Chapter 3: 15 steps
  { id: 'ch3-chest-1', chapterId: 3, afterStepIndex: 4, label: 'صندوقچه استدلال و راستی 🎁', gems: 40, hearts: 3 },
  { id: 'ch3-chest-2', chapterId: 3, afterStepIndex: 10, label: 'صندوقچه ترازوی هوشمند 🎁', gems: 55, hearts: 4 },
  // Chapter 4: 8 steps
  { id: 'ch4-chest-1', chapterId: 4, afterStepIndex: 2, label: 'صندوقچه منشورهای بلورین 🎁', gems: 40, hearts: 3 },
  { id: 'ch4-chest-2', chapterId: 4, afterStepIndex: 5, label: 'صندوقچه مکعب‌های جادویی 🎁', gems: 55, hearts: 4 },
  // Chapter 5: 7 steps
  { id: 'ch5-chest-1', chapterId: 5, afterStepIndex: 2, label: 'صندوقچه چرخ‌دنده‌های طلایی 🎁', gems: 45, hearts: 3 },
  { id: 'ch5-chest-2', chapterId: 5, afterStepIndex: 4, label: 'صندوقچه قطب‌نما و ناوبری 🎁', gems: 55, hearts: 4 },
  // Chapter 6: 4 steps
  { id: 'ch6-chest-1', chapterId: 6, afterStepIndex: 1, label: 'صندوقچه تراز و کارنامه نهایی 🎁', gems: 70, hearts: 5 },
]

export default function TizhooshanPrep({ student }: { student: any }) {
  const storageKey = `${STORAGE_KEY_PREFIX}${student?.id || 'guest'}`

  // Navigation mode: 'path' (Continuous Winding Road), 'endless' (Rapid Infinite Arena), 'league' (Class Leaderboard)
  const [activeMode, setActiveMode] = useState<'path' | 'endless' | 'league'>('path')

  // Selected Chapter for the dedicated Realm view
  const [selectedChapterId, setSelectedChapterId] = useState<number>(1)
  const [showRealmAtlasModal, setShowRealmAtlasModal] = useState<boolean>(false)
  const [lockedAlert, setLockedAlert] = useState<string | null>(null)

  // Progress State
  const [progress, setProgress] = useState<UserProgress>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          totalXp: parsed.totalXp ?? 0,
          gems: parsed.gems ?? 25,
          streak: parsed.streak ?? 1,
          hearts: parsed.hearts ?? 5,
          lastActiveDate: parsed.lastActiveDate ?? new Date().toISOString().split('T')[0],
          unlockedTopicIndex: parsed.unlockedTopicIndex ?? 0,
          completedTopics: parsed.completedTopics ?? {},
          completedQuestionIds: parsed.completedQuestionIds ?? [],
          openedChests: parsed.openedChests ?? [],
          wrongQuestionIds: parsed.wrongQuestionIds ?? [],
          dailyMultiplier: parsed.dailyMultiplier,
          dailyMultiplierDate: parsed.dailyMultiplierDate,
        }
      }
    } catch (e) {
      // Ignore
    }
    return {
      totalXp: 0,
      gems: 25,
      streak: 1,
      hearts: 5,
      lastActiveDate: new Date().toISOString().split('T')[0],
      unlockedTopicIndex: 0,
      completedTopics: {},
      completedQuestionIds: [],
      openedChests: [],
      wrongQuestionIds: [],
    }
  })

  // Load progress from server on mount
  useEffect(() => {
    if (!student?.id) return
    fetch(`/api/tizhooshan/progress?studentId=${student.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.progress) {
          setProgress((prev) => ({
            ...prev,
            ...data.progress,
            // Keep higher gems or hearts if locally earned
            totalXp: Math.max(prev.totalXp, data.progress.totalXp ?? 0),
            gems: Math.max(prev.gems, data.progress.gems ?? 25),
            unlockedTopicIndex: Math.max(prev.unlockedTopicIndex, data.progress.unlockedTopicIndex ?? 0),
            completedTopics: { ...(data.progress.completedTopics || {}), ...(prev.completedTopics || {}) },
          }))
        }
      })
      .catch((err) => console.warn('Failed to fetch cloud tizhooshan progress', err))
  }, [student?.id])

  // Save Progress to localStorage & Sync to Server
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress))
      if (student?.id) {
        const rawClass = localStorage.getItem('tizhooshan_class_progress')
        const classMap = rawClass ? JSON.parse(rawClass) : {}
        classMap[student.id] = {
          studentId: student.id,
          studentName: student.full_name,
          totalXp: progress.totalXp,
          gems: progress.gems,
          streak: progress.streak,
          hearts: progress.hearts,
          unlockedTopicIndex: progress.unlockedTopicIndex,
          completedTopicsCount: Object.keys(progress.completedTopics || {}).length,
          lastActiveDate: progress.lastActiveDate,
          wrongCount: (progress.wrongQuestionIds || []).length,
        }
        localStorage.setItem('tizhooshan_class_progress', JSON.stringify(classMap))

        // Sync to server persistent storage
        fetch('/api/tizhooshan/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: student.id,
            studentName: student.full_name,
            progress,
          }),
        }).catch((err) => console.warn('Cloud sync error for Tizhooshan', err))
      }
    } catch (e) {
      console.error(e)
    }
  }, [progress, storageKey, student])

  const todayStr = new Date().toISOString().split('T')[0]

  // Daily XP Multiplier: 1.5x or 2.0x deterministic per student per day
  const dailyMultiplier = useMemo(() => {
    if (progress.dailyMultiplierDate === todayStr && progress.dailyMultiplier) {
      return progress.dailyMultiplier
    }
    const hash = (student?.id || 'guest')
      .split('')
      .reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)
    const dayHash = todayStr.split('-').reduce((acc, c) => acc + Number(c), hash)
    return dayHash % 2 === 0 ? 2 : 1.5
  }, [todayStr, student?.id, progress.dailyMultiplierDate, progress.dailyMultiplier])

  // Classmates for League Leaderboard
  const [classmates, setClassmates] = useState<any[]>([])
  useEffect(() => {
    async function fetchClassmates() {
      try {
        const { data } = await supabase.rpc('list_students_public')
        if (data && data.length > 0) {
          setClassmates(data)
          return
        }
      } catch (err) {
        // Fallback
      }
      setClassmates([
        { id: 'c1', full_name: 'امیرعلی کریمی', avatar_url: '' },
        { id: 'c2', full_name: 'فاطمه رضایی', avatar_url: '' },
        { id: 'c3', full_name: 'محمدحسین حسینی', avatar_url: '' },
        { id: 'c4', full_name: 'سارا احمدی', avatar_url: '' },
        { id: 'c5', full_name: 'طاها موسوی', avatar_url: '' },
        { id: 'c6', full_name: 'نیکی باقری', avatar_url: '' },
        { id: 'c7', full_name: 'پارسا ابراهیمی', avatar_url: '' },
        { id: 'c8', full_name: 'مبینا جعفری', avatar_url: '' },
      ])
    }
    fetchClassmates()
  }, [])

  // Active Quiz State
  const [isEndlessActive, setIsEndlessActive] = useState(false)
  const [activeTopic, setActiveTopic] = useState<TizhooshanTopic | null>(null)
  const [showLessonSummaryModal, setShowLessonSummaryModal] = useState<TizhooshanTopic | null>(null)
  const [showHeartsModal, setShowHeartsModal] = useState(false)
  const [showFullLeague, setShowFullLeague] = useState(false)
  const [chestModalReward, setChestModalReward] = useState<{ label: string; gems: number; hearts: number } | null>(null)

  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [isAnswerChecked, setIsAnswerChecked] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [quizFinished, setQuizFinished] = useState(false)
  const [sessionXpEarned, setSessionXpEarned] = useState(0)
  const [sessionCorrectCount, setSessionCorrectCount] = useState(0)
  const [comboCount, setComboCount] = useState(0)
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([])

  // Endless Questions Queue
  const [endlessQuestions, setEndlessQuestions] = useState<TizhooshanQuestion[]>([])

  // Current League
  const league = useMemo(() => {
    return { name: 'لیگ کلاسی 🏆', color: '#2563EB', bg: '#EFF6FF', badge: 'کلاس' }
  }, [])

  // Current active question
  const currentQuestion: TizhooshanQuestion | null = useMemo(() => {
    if (isEndlessActive) {
      return endlessQuestions[currentQIndex] || null
    }
    if (activeTopic) {
      return activeTopic.questions[currentQIndex] || null
    }
    return null
  }, [isEndlessActive, endlessQuestions, activeTopic, currentQIndex])

  // Positive Mascot Feedback
  const mascotFeedback = useMemo(() => {
    if (!isAnswerChecked) return { icon: '🦉', text: 'با دقت فکر کن و بهترین گزینه رو انتخاب کن!' }
    if (isCorrect) {
      if (comboCount >= 3) return { icon: '🔥', text: 'فوق‌العاده‌ای! با همین تمرکز ادامه بده!' }
      if (comboCount === 2) return { icon: '⚡', text: 'عالی بود! سرعت و دقتت فوق‌العاده‌ست!' }
      return { icon: '😄', text: 'آفرین قهرمان کلاس ششم! پاسخ کاملاً درسته!' }
    }
    return { icon: '🧐', text: 'اشکالی نداره عزیزم! به تکنیک حل سوال دقت کن تا یاد بگیری.' }
  }, [isAnswerChecked, isCorrect, comboCount])

  // Leaderboard Calculation
  const leaderboard = useMemo(() => {
    const peers = classmates.map((c, idx) => {
      const seed = (c.full_name.charCodeAt(0) * 17 + idx * 73) % 450
      const baseline = 80 + seed + idx * 15
      return {
        id: c.id,
        name: c.full_name,
        avatar: c.avatar_url,
        xp: baseline,
        streak: (idx % 4) + 1,
        isMe: c.id === student?.id,
      }
    })

    const meExists = peers.some((p) => p.isMe)
    const myEntry = {
      id: student?.id || 'me',
      name: student?.full_name || 'شما',
      avatar: student?.avatar_url || '',
      xp: progress.totalXp,
      streak: progress.streak,
      isMe: true,
    }

    const allList = meExists
      ? peers.map((p) => (p.isMe ? { ...p, xp: progress.totalXp, streak: progress.streak } : p))
      : [...peers, myEntry]

    allList.sort((a, b) => b.xp - a.xp)
    return allList
  }, [classmates, student, progress.totalXp, progress.streak])

  const myRank = useMemo(() => {
    const idx = leaderboard.findIndex((p) => p.isMe)
    return idx !== -1 ? idx + 1 : 1
  }, [leaderboard])

  // Selected Chapter & Active Realm Topics
  const currentChapter = useMemo(() => {
    return tizhooshanChaptersData.find((ch) => ch.id === selectedChapterId) || tizhooshanChaptersData[0]
  }, [selectedChapterId])

  const currentChapterTopics = useMemo(() => {
    return tizhooshanTopicsData.filter((t) => t.chapterId === currentChapter.id)
  }, [currentChapter.id])

  const currentChapterChests = useMemo(() => {
    return CHAPTER_CHESTS.filter((c) => c.chapterId === currentChapter.id)
  }, [currentChapter.id])

  const currentChapterIndex = useMemo(() => {
    return tizhooshanChaptersData.findIndex((ch) => ch.id === currentChapter.id)
  }, [currentChapter.id])

  const nextChapter = useMemo(() => {
    if (currentChapterIndex < tizhooshanChaptersData.length - 1) {
      return tizhooshanChaptersData[currentChapterIndex + 1]
    }
    return null
  }, [currentChapterIndex])

  const prevChapter = useMemo(() => {
    if (currentChapterIndex > 0) {
      return tizhooshanChaptersData[currentChapterIndex - 1]
    }
    return null
  }, [currentChapterIndex])

  // Chapter Unlock Checker: Chapter 1 is always unlocked.
  // Subsequent chapters are locked until all topics of the preceding chapter are completed.
  const isChapterUnlocked = useCallback(
    (chapterId: number): boolean => {
      if (chapterId === 1) return true
      const cIndex = tizhooshanChaptersData.findIndex((c) => c.id === chapterId)
      if (cIndex <= 0) return true
      const prevChap = tizhooshanChaptersData[cIndex - 1]
      const prevTopics = tizhooshanTopicsData.filter((t) => t.chapterId === prevChap.id)
      if (prevTopics.length === 0) return true
      const completedPrev = prevTopics.filter((t) => Boolean(progress.completedTopics[t.id])).length
      return completedPrev >= prevTopics.length
    },
    [progress.completedTopics]
  )

  const isCurrentChapterCompleted = useMemo(() => {
    if (!currentChapterTopics.length) return false
    const done = currentChapterTopics.filter((t) => Boolean(progress.completedTopics[t.id])).length
    return done >= currentChapterTopics.length
  }, [currentChapterTopics, progress.completedTopics])

  // Start Topic (Standard Roadmap)
  function startTopic(topic: TizhooshanTopic) {
    if (progress.hearts <= 0) {
      playSound('wrong')
      setShowHeartsModal(true)
      setLockedAlert('قلب‌های شما تمام شده است! لطفاً با الماس‌های خود قلب شارژ کنید یا با تمرین در صندوق اشتباهات، قلب رایگان به دست آورید.')
      return
    }
    playSound('click')
    // Keep curriculum coherent with authentic topic questions without mixing unrelated random questions
    const hydratedTopic = { ...topic, questions: [...topic.questions] }

    setActiveTopic(hydratedTopic)
    setIsEndlessActive(false)
    setCurrentQIndex(0)
    setSelectedOption(null)
    setIsAnswerChecked(false)
    setIsCorrect(false)
    setShowHint(false)
    setQuizFinished(false)
    setSessionXpEarned(0)
    setSessionCorrectCount(0)
    setComboCount(0)
    setEliminatedOptions([])
    setShowLessonSummaryModal(null)
  }

  // Start Mistakes Review (صندوق اشتباهات و بازآموزی)
  function startMistakesReview() {
    playSound('click')
    const wrongIds = progress.wrongQuestionIds || []
    if (wrongIds.length === 0) return
    const allQuestions: TizhooshanQuestion[] = []
    tizhooshanTopicsData.forEach((t) => allQuestions.push(...t.questions))
    const mistakeQuestions = allQuestions.filter((q) => wrongIds.includes(q.id))
    if (mistakeQuestions.length === 0) return

    const topic: TizhooshanTopic = {
      id: 'mistakes_review',
      chapterId: 1,
      chapterTitle: 'صندوق اشتباهات و بازآموزی',
      chapterIcon: '🩹',
      unitNumber: 0,
      topic: 'صندوق اشتباهات و بازآموزی 🩹',
      category: 'مرور و تثبیت آموخته‌ها',
      icon: '🩹',
      lesson_summary: 'در این بخش سوالاتی که قبلاً اشتباه پاسخ داده بودید را مجدداً حل می‌کنید تا با پاسخ صحیح، قلب‌های از دست رفته‌تان بازگردد.',
      questions: mistakeQuestions,
    }

    setActiveTopic(topic)
    setIsEndlessActive(false)
    setCurrentQIndex(0)
    setSelectedOption(null)
    setIsAnswerChecked(false)
    setIsCorrect(false)
    setShowHint(false)
    setQuizFinished(false)
    setSessionXpEarned(0)
    setSessionCorrectCount(0)
    setComboCount(0)
    setEliminatedOptions([])
    setShowLessonSummaryModal(null)
  }

  // Start Endless Arena Mode
  function startEndlessPractice() {
    playSound('click')
    const initialBatch = [
      generateRandomTizhooshanQuestion(),
      generateRandomTizhooshanQuestion(),
      generateRandomTizhooshanQuestion(),
      generateRandomTizhooshanQuestion(),
      generateRandomTizhooshanQuestion(),
    ]
    setEndlessQuestions(initialBatch)
    setIsEndlessActive(true)
    setActiveTopic(null)
    setCurrentQIndex(0)
    setSelectedOption(null)
    setIsAnswerChecked(false)
    setIsCorrect(false)
    setShowHint(false)
    setQuizFinished(false)
    setSessionXpEarned(0)
    setSessionCorrectCount(0)
    setComboCount(0)
    setEliminatedOptions([])
  }

  // 50/50 Lifeline
  function handleUseLifeline5050() {
    if (!currentQuestion || isAnswerChecked || eliminatedOptions.length > 0) return
    playSound('lifeline')
    const wrongIndices = currentQuestion.options
      .map((_, idx) => idx)
      .filter((idx) => idx !== currentQuestion.correct_index)
    const toEliminate = wrongIndices.sort(() => 0.5 - Math.random()).slice(0, 2)
    setEliminatedOptions(toEliminate)
  }

  // Open Treasure Chest
  function handleOpenChest(chest: ChapterChest) {
    if (progress.openedChests.includes(chest.id)) return
    playSound('chest')
    triggerConfetti()

    setProgress((prev) => ({
      ...prev,
      gems: prev.gems + chest.gems,
      hearts: Math.min(5, prev.hearts + chest.hearts),
      openedChests: [...prev.openedChests, chest.id],
    }))

    setChestModalReward({
      label: chest.label,
      gems: chest.gems,
      hearts: chest.hearts,
    })
  }

  // Check Answer Handler
  function handleCheckAnswer(selectedIdx?: number) {
    const optToEvaluate = selectedIdx !== undefined ? selectedIdx : selectedOption
    if (!currentQuestion || optToEvaluate === null || isAnswerChecked) return
    const correct = optToEvaluate === currentQuestion.correct_index

    setSelectedOption(optToEvaluate)
    setIsAnswerChecked(true)
    setIsCorrect(correct)

    if (correct) {
      const nextCombo = comboCount + 1
      setComboCount(nextCombo)

      if (nextCombo >= 2) {
        playSound('combo')
      } else {
        playSound('correct')
      }
      triggerConfetti()

      const comboBonus = nextCombo >= 3 ? 10 : nextCombo === 2 ? 5 : 0
      const baseEarned = currentQuestion.xp + comboBonus
      const gained = Math.round(baseEarned * dailyMultiplier)

      setSessionXpEarned((prev) => prev + gained)
      setSessionCorrectCount((prev) => prev + 1)

      const isMistakesMode = activeTopic?.id === 'mistakes_review'

      setProgress((prev) => ({
        ...prev,
        totalXp: prev.totalXp + gained,
        gems: prev.gems + 1,
        hearts: isMistakesMode ? Math.min(5, prev.hearts + 1) : prev.hearts,
        wrongQuestionIds: isMistakesMode
          ? (prev.wrongQuestionIds || []).filter((id) => id !== currentQuestion.id)
          : prev.wrongQuestionIds,
        completedQuestionIds: prev.completedQuestionIds.includes(currentQuestion.id)
          ? prev.completedQuestionIds
          : [...prev.completedQuestionIds, currentQuestion.id],
      }))
    } else {
      playSound('wrong')
      setComboCount(0)
      setProgress((prev) => ({
        ...prev,
        hearts: Math.max(0, prev.hearts - 1),
        wrongQuestionIds: Array.from(new Set([...(prev.wrongQuestionIds || []), currentQuestion.id])),
      }))
    }
  }

  // Next Question Handler
  function handleNextQuestion() {
    playSound('click')
    setSelectedOption(null)
    setIsAnswerChecked(false)
    setIsCorrect(false)
    setShowHint(false)
    setEliminatedOptions([])

    if (isEndlessActive) {
      // Endless mode: seamlessly append questions so it never ends
      if (currentQIndex + 2 >= endlessQuestions.length) {
        setEndlessQuestions((prev) => [
          ...prev,
          generateRandomTizhooshanQuestion(),
          generateRandomTizhooshanQuestion(),
        ])
      }
      setCurrentQIndex((prev) => prev + 1)
    } else if (activeTopic) {
      if (currentQIndex + 1 < activeTopic.questions.length) {
        setCurrentQIndex((prev) => prev + 1)
      } else {
        // Finished Topic!
        playSound('complete')
        triggerConfetti()
        setQuizFinished(true)

        const topicIndex = tizhooshanTopicsData.findIndex((t) => t.id === activeTopic.id)
        const isNextUnlocked = Math.max(progress.unlockedTopicIndex, topicIndex + 1)

        setProgress((prev) => ({
          ...prev,
          unlockedTopicIndex: isNextUnlocked,
          hearts: Math.min(5, prev.hearts + 1),
          gems: prev.gems + 5,
          completedTopics: {
            ...prev.completedTopics,
            [activeTopic.id]: {
              stars: 3,
              xpEarned: (prev.completedTopics[activeTopic.id]?.xpEarned || 0) + sessionXpEarned,
              completedAt: new Date().toISOString(),
            },
          },
        }))
      }
    }
  }

  function handleRefillHeartsWithGems() {
    if (progress.gems < 20) return
    playSound('complete')
    setProgress((prev) => ({
      ...prev,
      gems: prev.gems - 20,
      hearts: 5,
    }))
    setShowHeartsModal(false)
  }

  function handleBuyBoostWithGems() {
    if (progress.gems < 30) return
    playSound('complete')
    triggerConfetti()
    setProgress((prev) => ({
      ...prev,
      gems: prev.gems - 30,
      dailyMultiplier: 2,
      dailyMultiplierDate: new Date().toISOString().split('T')[0],
    }))
    setShowHeartsModal(false)
  }

  return (
    <div className="tizhooshan-container">
      {/* Duolingo Sticky Top Bar */}
      <div className="tizhooshan-topbar">
        <div className="tizhooshan-brand">
          <span className="owl-mascot">🦉</span>
          <div className="brand-text">
            <span className="brand-title">باشگاه استعداد تحلیلی</span>
          </div>
        </div>

        {/* Gamification Stats: Hearts, Gems, Streak, Mistakes */}
        <div className="tizhooshan-stats-bar" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div
            className="stat-pill hearts-pill"
            style={{
              cursor: 'pointer',
              background: progress.hearts <= 1 ? '#FEE2E2' : '#FFFFFF',
              border: progress.hearts <= 1 ? '1.5px solid #EF4444' : '1.5px solid #E2E8F0',
            }}
            title="فرصت‌های پاسخ‌دهی (کلیک برای شارژ یا فروشگاه)"
            onClick={() => setShowHeartsModal(true)}
          >
            <span className="stat-icon">{progress.hearts > 0 ? '❤️' : '💔'}</span>
            <span className="stat-num">{progress.hearts}</span>
          </div>

          <div
            className="stat-pill gems-pill"
            style={{ cursor: 'pointer' }}
            title="الماس‌ها (کلیک برای خرید امکانات)"
            onClick={() => setShowHeartsModal(true)}
          >
            <span className="stat-icon">💎</span>
            <span className="stat-num">{progress.gems}</span>
          </div>

          <div className="stat-pill streak-pill" title="روزهای متوالی مطالعه">
            <span className="stat-icon pulse-fire">🔥</span>
            <span className="stat-num">{progress.streak}</span>
          </div>

          {(progress.wrongQuestionIds || []).length > 0 && (
            <button
              type="button"
              className="stat-pill mistakes-pill"
              style={{
                cursor: 'pointer',
                background: '#FEF3C7',
                border: '1.5px solid #F59E0B',
                color: '#B45309',
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
              }}
              title="صندوق اشتباهات: حل دوباره سوالات غلط و بازگرداندن قلب‌ها"
              onClick={startMistakesReview}
            >
              <span>🩹</span>
              <span>صندوق اشتباهات ({(progress.wrongQuestionIds || []).length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Daily XP Multiplier Lucky Bonus Banner */}
      <div
        style={{
          maxWidth: 640,
          margin: '0 auto 10px auto',
          background: dailyMultiplier >= 2 ? 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)' : '#EFF6FF',
          border: `2px solid ${dailyMultiplier >= 2 ? '#F59E0B' : '#3B82F6'}`,
          borderRadius: 14,
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12.5,
          fontWeight: 800,
          color: dailyMultiplier >= 2 ? '#92400E' : '#1E40AF',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{dailyMultiplier >= 2 ? '🔥' : '⚡'}</span>
          <span>
            پاداش شانس روزانه: ضریب {dailyMultiplier === 2 ? '۲ برابری (2x XP)' : '۱/۵ برابری (1.5x XP)'} برای تمام سوالات امروز فعال است!
          </span>
        </div>
        <span style={{ fontSize: 11, background: '#FFFFFF', padding: '2px 8px', borderRadius: 8, border: '1px solid currentColor' }}>
          هدیه روزانه
        </span>
      </div>

      {/* Floating Alert for Locked Chapters/Activities */}
      {lockedAlert && (
        <div
          style={{
            maxWidth: 640,
            margin: '0 auto 12px auto',
            background: '#FEF2F2',
            border: '2px solid #EF4444',
            borderRadius: 14,
            padding: '10px 14px',
            color: '#991B1B',
            fontWeight: 800,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span>{lockedAlert}</span>
          <button
            type="button"
            onClick={() => setLockedAlert(null)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#991B1B',
              fontWeight: 900,
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================
          ROADMAP + SPEED PRACTICE
          ======================================================== */}
      <div className="tizhooshan-roadmap-content">
        <div className="continuous-path-container" style={{ width: '100%', maxWidth: '640px', margin: '0 auto' }}>
          {/* Unified Class League Standings Strip */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              border: '2px solid var(--black)',
              padding: '14px 16px',
              marginBottom: 16,
              boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>🏆</span>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 900, margin: 0, color: 'var(--black)' }}>
                    جدول امتیازات کلاس
                  </h4>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowFullLeague((v) => !v)}
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: 10,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  color: '#1E293B',
                }}
              >
                {showFullLeague ? 'بستن رده‌بندی ▲' : 'مشاهده کل کلاس ▼'}
              </button>
            </div>

            {/* Compact Podium Top 3 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
              {leaderboard.slice(0, 3).map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    background: item.isMe ? '#EFF6FF' : '#F8FAFC',
                    border: item.isMe ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: '8px 4px',
                  }}
                >
                  <div style={{ fontSize: 18 }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name} {item.isMe && '(شما)'}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>
                    {item.xp} XP
                  </div>
                </div>
              ))}
            </div>

            {/* Expanded Leaderboard */}
            {showFullLeague && (
              <div style={{ marginTop: 14, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {leaderboard.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: 8,
                        background: item.isMe ? '#DBEAFE' : '#F8FAFC',
                        border: item.isMe ? '1px solid #93C5FD' : '1px solid transparent',
                        fontSize: 12.5,
                      }}
                    >
                      <span style={{ fontWeight: 800, width: 28 }}>#{idx + 1}</span>
                      <span style={{ flex: 1, fontWeight: 800, color: '#0F172A' }}>
                        {item.name} {item.isMe && '(شما)'}
                      </span>
                      <span style={{ color: '#64748B', fontWeight: 700 }}>🔥 {item.streak} روز</span>
                      <span style={{ fontWeight: 900, color: '#1E293B', marginRight: 10 }}>{item.xp} XP</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Clean Layout of Chapters with Locked Future Chapters */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#475569' }}>
                📚 سرفصل‌های آموزشی:
              </span>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>
                فصل‌های بعدی پس از تکمیل فصل‌های قبل باز می‌شوند 🔒
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 8,
              }}
            >
              {tizhooshanChaptersData.map((ch) => {
                const isSelected = ch.id === currentChapter.id
                const isUnlocked = isChapterUnlocked(ch.id)
                const chapterTopics = tizhooshanTopicsData.filter((t) => t.chapterId === ch.id)
                const doneCount = chapterTopics.filter((t) => Boolean(progress.completedTopics[t.id])).length
                const pct = chapterTopics.length > 0 ? Math.round((doneCount / chapterTopics.length) * 100) : 0

                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      if (!isUnlocked) {
                        playSound('wrong')
                        setLockedAlert(`فصل ${ch.id} قفل است! برای باز شدن، ابتدا تمام گام‌های فصل قبلی را با موفقیت تکمیل کنید 🔒`)
                        setTimeout(() => setLockedAlert(null), 3500)
                        return
                      }
                      setSelectedChapterId(ch.id)
                      playSound('click')
                    }}
                    style={{
                      background: !isUnlocked
                        ? '#F8FAFC'
                        : isSelected
                        ? ch.cardGradient
                        : '#FFFFFF',
                      color: !isUnlocked
                        ? '#94A3B8'
                        : isSelected
                        ? '#FFFFFF'
                        : 'var(--black)',
                      border: !isUnlocked
                        ? '2px dashed #CBD5E1'
                        : isSelected
                        ? `2px solid ${ch.accentColor}`
                        : '2px solid #E2E8F0',
                      borderRadius: 14,
                      padding: '10px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      cursor: !isUnlocked ? 'not-allowed' : 'pointer',
                      opacity: !isUnlocked ? 0.65 : 1,
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected && isUnlocked ? `0 4px 12px ${ch.accentColor}40` : 'none',
                      position: 'relative',
                    }}
                  >
                    {!isUnlocked && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          fontSize: 10,
                          background: '#E2E8F0',
                          color: '#64748B',
                          padding: '1px 6px',
                          borderRadius: 999,
                          fontWeight: 800,
                        }}
                      >
                        🔒 قفل
                      </span>
                    )}
                    <span style={{ fontSize: 22 }}>{!isUnlocked ? '🔒' : ch.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, opacity: isSelected && isUnlocked ? 0.9 : 0.65, marginTop: 2 }}>
                      فصل {ch.id} {!isUnlocked && '(قفل)'}
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 900,
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}
                    >
                      {ch.title.replace(`فصل ${ch.id}: `, '')}
                    </span>
                    <span style={{ fontSize: 10.5, opacity: isSelected && isUnlocked ? 0.9 : 0.7, marginTop: 2 }}>
                      {isUnlocked ? `${doneCount} از ${chapterTopics.length} گام (${pct}٪)` : 'قفل است'}
                    </span>
                    {isUnlocked && (
                      <div
                        style={{
                          marginTop: 6,
                          width: '100%',
                          background: isSelected ? 'rgba(255,255,255,0.3)' : '#E2E8F0',
                          height: 5,
                          borderRadius: 999,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: isSelected ? '#FFFFFF' : ch.color,
                          }}
                        />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

            {/* Realm Hero Banner */}
            {(() => {
              const completedCount = currentChapterTopics.filter((t) => progress.completedTopics[t.id]).length
              const percent = currentChapterTopics.length > 0 ? Math.round((completedCount / currentChapterTopics.length) * 100) : 0

              return (
                <div
                  className="section-banner-duo"
                  style={{
                    background: currentChapter.cardGradient,
                    boxShadow: `0 8px 24px ${currentChapter.accentColor}33`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>
                      {currentChapter.environmentName}
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 900, margin: '4px 0', color: '#FFFFFF' }}>
                      {currentChapter.icon} {currentChapter.title}
                    </h3>
                    <div style={{ fontSize: '12.5px', opacity: 0.95, maxWidth: '440px' }}>
                      {currentChapter.desc}
                    </div>
                  </div>

                  <div style={{ textAlign: 'left', minWidth: '85px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 900 }}>{percent}٪</div>
                    <div style={{ fontSize: '11px', opacity: 0.9 }}>
                      {completedCount} از {currentChapterTopics.length} گام
                    </div>
                    <div
                      style={{
                        width: '80px',
                        height: '8px',
                        borderRadius: '999px',
                        background: 'rgba(255, 255, 255, 0.3)',
                        overflow: 'hidden',
                        marginTop: '6px',
                      }}
                    >
                      <div
                        style={{
                          width: `${percent}%`,
                          height: '100%',
                          background: '#FFFFFF',
                          borderRadius: '999px',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Winding zig-zag path of nodes for this chapter */}
            <div className="duolingo-path-wrapper" style={{ padding: '8px 0' }}>
              <div className="duolingo-nodes-path">
                {currentChapterTopics.map((t, idx) => {
                  const isCompleted = Boolean(progress.completedTopics[t.id])
                  // First topic of the chapter is unlocked; subsequent unlock sequentially
                  const isUnlocked = idx === 0 || Boolean(progress.completedTopics[currentChapterTopics[idx - 1]?.id])
                  const isCurrent = isUnlocked && !isCompleted && (idx === 0 || Boolean(progress.completedTopics[currentChapterTopics[idx - 1]?.id]))

                  // Winding offset
                  const offsets = [0, -38, 38, -26, 26, 0]
                  const xOffset = offsets[idx % offsets.length]

                  // Check if a treasure chest should appear right after this topic
                  const chestAfter = currentChapterChests.find((c) => c.afterStepIndex === idx)

                  return (
                    <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div
                        className="path-node-row"
                        style={{ transform: `translateX(${xOffset}px)` }}
                      >
                        <div className="node-wrapper">
                          {/* Floating Duo Owl on the current active station */}
                          {isCurrent && (
                            <div className="duo-floating-owl">
                              <div className="duo-owl-bubble">گام بعدی رو بزن! 🎯</div>
                              <span className="duo-owl-avatar">🦉</span>
                            </div>
                          )}

                          {isCurrent && <div className="pulse-aura" />}

                          <button
                            type="button"
                            className={`duolingo-circle-btn ${
                              isCompleted
                                ? 'completed'
                                : isCurrent
                                ? 'current'
                                : isUnlocked
                                ? 'unlocked'
                                : 'locked'
                            }`}
                            disabled={!isUnlocked}
                            onClick={() => setShowLessonSummaryModal(t)}
                            aria-label={t.topic}
                          >
                            <span className="node-icon">{t.icon}</span>
                            {isCompleted && <span className="crown-badge">⭐</span>}
                            {!isUnlocked && <span className="lock-badge">🔒</span>}
                          </button>

                          {/* Label Box */}
                          <div
                            className={`node-label-box ${isCurrent ? 'active' : ''}`}
                            onClick={() => isUnlocked && setShowLessonSummaryModal(t)}
                          >
                            <span className="node-title">{t.topic}</span>
                            <div className="node-meta">
                              <span className="q-count">{t.questions.length} سوال</span>
                              <span className="xp-tag">
                                +{t.questions.reduce((sum, q) => sum + q.xp, 0)} XP
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Treasure Chest if configured for this position */}
                      {chestAfter && (
                        <div className="treasure-chest-row">
                          {progress.openedChests.includes(chestAfter.id) ? (
                            <div className="treasure-chest-btn opened">
                              <span style={{ fontSize: '20px' }}>📦✨</span>
                              <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748B' }}>
                                صندوقچه باز شد (+{chestAfter.gems} 💎)
                              </span>
                            </div>
                          ) : isUnlocked ? (
                            <button
                              type="button"
                              className="treasure-chest-btn available"
                              onClick={() => handleOpenChest(chestAfter)}
                              title="کلیک کن تا جایزه بگیری!"
                            >
                              <span style={{ fontSize: '24px' }}>🎁</span>
                              <span style={{ fontSize: '13px', fontWeight: 900, color: '#B45309' }}>
                                {chestAfter.label} (باز کردن!)
                              </span>
                            </button>
                          ) : (
                            <div className="treasure-chest-btn" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                              <span style={{ fontSize: '20px' }}>🔒🎁</span>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8' }}>
                                {chestAfter.label}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Chapter Mastery Trophy */}
            {(() => {
              const completedCount = currentChapterTopics.filter((t) => progress.completedTopics[t.id]).length
              const isAllDone = completedCount === currentChapterTopics.length

              return (
                <div className="unit-trophy-card">
                  <span style={{ fontSize: '38px' }}>🏆</span>
                  <h4 style={{ fontSize: '16px', fontWeight: 900, color: '#92400E', margin: '6px 0 2px 0' }}>
                    جام فتح {currentChapter.realmName}
                  </h4>
                  <p style={{ fontSize: '12px', color: '#B45309', margin: 0 }}>
                    {isAllDone
                      ? '✅ تبریک شگفت‌انگیز! شما تمام گام‌های این اقلیم را با افتخار فتح کردید!'
                      : `با گذراندن تمام ${currentChapterTopics.length} گام، این جام زرین را به دست بیاور! (${completedCount} از ${currentChapterTopics.length})`}
                  </p>
                </div>
              )
            })()}

            {/* Portal Gate to Next World (Locked until all chapter topics are completed) */}
            {nextChapter ? (
              isCurrentChapterCompleted ? (
                <div className="realm-portal-gate">
                  <div style={{ fontSize: '42px', marginBottom: '4px' }}>🌌✨</div>
                  <h3 className="portal-title">دروازه ورود به فصل بعدی: {nextChapter.title}</h3>
                  <p className="portal-subtitle">
                    تبریک! شما این فصل را فتح کردید. اکنون می‌توانید وارد اقلیم «{nextChapter.environmentName}» شوید!
                  </p>
                  <button
                    type="button"
                    className="portal-btn"
                    onClick={() => {
                      setSelectedChapterId(nextChapter.id)
                      playSound('complete')
                      triggerConfetti()
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    🚀 صعود به {nextChapter.realmName} ➔
                  </button>
                </div>
              ) : (
                <div
                  className="realm-portal-gate"
                  style={{
                    background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
                    borderColor: '#64748B',
                  }}
                >
                  <div style={{ fontSize: '38px', marginBottom: '4px' }}>🔒🌌</div>
                  <h3 className="portal-title">دروازه ورود به فصل بعدی: {nextChapter.title} (قفل)</h3>
                  <p className="portal-subtitle">
                    برای باز شدن این دروازه، باید تمامی {currentChapterTopics.length} گام فصل فعلی را فتح کنی! ({currentChapterTopics.filter((t) => progress.completedTopics[t.id]).length} از {currentChapterTopics.length} انجام شده)
                  </p>
                  <button
                    type="button"
                    className="portal-btn"
                    disabled
                    style={{
                      background: '#64748B',
                      cursor: 'not-allowed',
                      opacity: 0.8,
                      boxShadow: 'none',
                    }}
                  >
                    🔒 ابتدا تمام گام‌های این فصل را بگذرانید
                  </button>
                </div>
              )
            ) : (
              <div
                className="realm-portal-gate"
                style={{
                  background: 'linear-gradient(135deg, #78350F 0%, #B45309 50%, #D97706 100%)',
                  borderColor: '#F59E0B',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '6px' }}>👑🏆</div>
                <h3 className="portal-title">فینال بزرگ: تمام اقلیم‌ها فتح شدند!</h3>
                <p className="portal-subtitle">
                  آفرین نابغه! تو تمام ۶ فصل و بیش از ۸۰ گام تخصصی را به پایان رساندی و آماده درخشش هستی!
                </p>
              </div>
            )}

            {/* ========================================================
                SPEED PRACTICE SECTION (DIRECTLY UNDER LEAGUE & ROADMAP)
                ======================================================== */}
            <div className="endless-arena-container" style={{ marginTop: 28, padding: 0 }}>
              <div
                className="endless-hero-card"
                style={{
                  border: '2.5px solid var(--black)',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                  background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                }}
              >
                <div className="endless-badge-hero">⚡ ماراتن تمرین سرعتی و بی‌پایان</div>
                <h2 className="endless-title">آرنای تمرین سرعتی پیوسته</h2>
                <p className="endless-desc">
                  اینجا سوالات هیچ‌وقت تمام نمی‌شوند! با حل سریع سوالات الگوها، جایگشت، ساعت، تقویم و سه‌راهی برق،
                  XP بالا جمع کن و در جدول امتیازات کلاس پیشرفت کن.
                </p>

                <div className="endless-stats-box">
                  <div className="stat-item">
                    <span className="val">♾️</span>
                    <span className="lbl">تعداد سوالات</span>
                  </div>
                  <div className="stat-item">
                    <span className="val">+۱۵ تا ۳۵</span>
                    <span className="lbl">XP برای هر سوال</span>
                  </div>
                  <div className="stat-item">
                    <span className="val">⚡</span>
                    <span className="lbl">ارتقای امتیاز</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="endless-launch-btn"
                  onClick={startEndlessPractice}
                >
                  🚀 شروع تمرین سرعتی و بی‌پایان
                </button>
              </div>

              <div className="covered-skills-panel" style={{ marginTop: 14 }}>
                <h4 className="panel-title">مباحث فعال در تمرین سرعتی:</h4>
                <div className="skills-grid">
                  <div className="skill-chip">🔢 جایگشت ارقام ۴ رقمی و ترتیبی</div>
                  <div className="skill-chip">🔌 سه‌راهی و چندراهی برق و پریزها</div>
                  <div className="skill-chip">👥 عضویت گروه‌های پژوهشی</div>
                  <div className="skill-chip">🧭 جهت‌یابی نقشه چرخشی ۹۰ درجه</div>
                  <div className="skill-chip">📈 الگوهای حسابی و تصاعدها</div>
                  <div className="skill-chip">📅 تقویم و شمارش روزهای هفته</div>
                  <div className="skill-chip">⏰ زاویه بین عقربه‌های ساعت</div>
                  <div className="skill-chip">🧮 معادلات حسابی جای خالی</div>
                  <div className="skill-chip">🎲 تاس و وجوه متقابل</div>
                  <div className="skill-chip">📐 شمارش فرمولی مثلث‌ها و مربع‌ها</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* ========================================================
          POPUP MODAL: DUOLINGO LESSON SUMMARY & PREVIEW
          ======================================================== */}
      {showLessonSummaryModal && (
        <div className="duo-modal-overlay" onClick={() => setShowLessonSummaryModal(null)}>
          <div className="duo-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-icon">
              <span className="big-icon">{showLessonSummaryModal.icon}</span>
            </div>
            <h3 className="modal-topic-title">{showLessonSummaryModal.topic}</h3>
            <div className="modal-badge-row">
              <span className="cat-badge">{showLessonSummaryModal.category}</span>
              <span className="q-badge">{showLessonSummaryModal.questions.length} سوال تستی استاندارد</span>
              <span className="xp-badge">
                +{showLessonSummaryModal.questions.reduce((sum, q) => sum + q.xp, 0)} XP
              </span>
            </div>

            <div className="modal-lesson-summary">
              <h4 className="summary-title">💡 نکته کلیدی این درس:</h4>
              <p className="summary-text">{showLessonSummaryModal.lesson_summary}</p>
            </div>

            <div className="modal-action-buttons">
              <button
                type="button"
                className="start-lesson-btn"
                onClick={() => startTopic(showLessonSummaryModal)}
              >
                شروع درس (+{showLessonSummaryModal.questions.reduce((sum, q) => sum + q.xp, 0)} XP)
              </button>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setShowLessonSummaryModal(null)}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          POPUP MODAL: TREASURE CHEST OPENED REWARD
          ======================================================== */}
      {chestModalReward && (
        <div className="duo-modal-overlay" onClick={() => setChestModalReward(null)}>
          <div className="duo-modal-card" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '54px', marginBottom: '8px', animation: 'duoFloatOwl 2s infinite' }}>🎁✨</div>
            <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#1E293B', margin: '0 0 8px 0' }}>
              صندوقچه گنج باز شد!
            </h3>
            <p style={{ fontSize: '13.5px', color: '#64748B', marginBottom: '20px' }}>
              آفرین به تلاش و پیوستگیت! این پاداش فوق‌العاده برای توست:
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: '#FEF3C7', border: '2px solid #FCD34D', borderRadius: '16px', padding: '12px 20px' }}>
                <div style={{ fontSize: '24px' }}>💎</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#B45309' }}>+{chestModalReward.gems} الماس</div>
              </div>
              <div style={{ background: '#FEE2E2', border: '2px solid #FCA5A5', borderRadius: '16px', padding: '12px 20px' }}>
                <div style={{ fontSize: '24px' }}>❤️</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#B91C1C' }}>+{chestModalReward.hearts} قلب</div>
              </div>
            </div>

            <button
              type="button"
              className="start-lesson-btn"
              onClick={() => setChestModalReward(null)}
            >
              دریافت جوایز و ادامه مسیر 🚀
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          POPUP MODAL: REFILL HEARTS
          ======================================================== */}
      {showHeartsModal && (
        <div className="duo-modal-overlay" onClick={() => setShowHeartsModal(false)}>
          <div className="duo-modal-card" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>❤️</div>
            <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#1E293B', margin: '0 0 8px 0' }}>
              وضعیت فرصت‌ها (جان‌های پاسخ‌دهی)
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>
              هر پاسخ اشتباه یک قلب کم می‌کند. با اتمام موفقیت‌آمیز درس‌ها یا باز کردن صندوقچه‌ها قلبت دوباره پر می‌شود!
            </p>

            <div style={{ fontSize: '28px', marginBottom: '20px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ opacity: i < progress.hearts ? 1 : 0.25, margin: '0 3px' }}>
                  ❤️
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="start-lesson-btn"
                disabled={progress.gems < 20}
                onClick={handleRefillHeartsWithGems}
                style={{
                  background: progress.gems >= 20 ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' : '#CBD5E1',
                  boxShadow: progress.gems >= 20 ? '0 5px 0 #991B1B' : 'none',
                }}
              >
                ❤️ شارژ کامل ۵ قلب با ۲۰ الماس 💎 (موجودی: {progress.gems})
              </button>

              <button
                type="button"
                className="start-lesson-btn"
                disabled={progress.gems < 30}
                onClick={handleBuyBoostWithGems}
                style={{
                  background: progress.gems >= 30 ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : '#CBD5E1',
                  boxShadow: progress.gems >= 30 ? '0 5px 0 #B45309' : 'none',
                }}
              >
                🔥 خرید بوست ۲ برابری امتیاز (2x XP) با ۳۰ الماس 💎
              </button>

              {(progress.wrongQuestionIds || []).length > 0 && (
                <button
                  type="button"
                  className="start-lesson-btn"
                  onClick={() => {
                    setShowHeartsModal(false)
                    startMistakesReview()
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    boxShadow: '0 5px 0 #047857',
                  }}
                >
                  🩹 تمرین رایگان در صندوق اشتباهات (بازیابی قلب با حل درست!)
                </button>
              )}

              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setShowHeartsModal(false)}
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          POPUP MODAL: REALM ATLAS / WORLD MAP (نقشه اقلیم‌ها)
          ======================================================== */}
      {showRealmAtlasModal && (
        <div className="duo-modal-overlay" onClick={() => setShowRealmAtlasModal(false)}>
          <div className="realm-atlas-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="atlas-modal-header">
              <div>
                <h3 className="atlas-modal-title">نقشه اقلیم‌های شش‌گانه تیزهوشان 🗺️</h3>
                <p className="atlas-modal-desc">
                  هر فصل دنیایی مستقل با بیش از ۱۰ تا ۲۲ گام و دایره‌های تخصصی است. اقلیم مورد نظر خود را انتخاب کن:
                </p>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                style={{ minWidth: '40px', padding: '8px 12px' }}
                onClick={() => setShowRealmAtlasModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="atlas-realms-grid">
              {tizhooshanChaptersData.map((ch) => {
                const isSelected = ch.id === currentChapter.id
                const isUnlocked = isChapterUnlocked(ch.id)
                const chapterTopics = tizhooshanTopicsData.filter((t) => t.chapterId === ch.id)
                const completedCount = chapterTopics.filter((t) => progress.completedTopics[t.id]).length
                const percent = chapterTopics.length > 0 ? Math.round((completedCount / chapterTopics.length) * 100) : 0

                return (
                  <div
                    key={ch.id}
                    className={`atlas-realm-card ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      if (!isUnlocked) {
                        playSound('wrong')
                        setLockedAlert(`اقلیم فصل ${ch.id} هنوز قفل است! برای ورود باید فصل‌های قبل را فتح کنید 🔒`)
                        setTimeout(() => setLockedAlert(null), 3500)
                        return
                      }
                      setSelectedChapterId(ch.id)
                      setShowRealmAtlasModal(false)
                      playSound('click')
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    style={{
                      opacity: !isUnlocked ? 0.6 : 1,
                      cursor: !isUnlocked ? 'not-allowed' : 'pointer',
                      border: !isUnlocked ? '2px dashed #94A3B8' : undefined,
                    }}
                  >
                    <div className="realm-card-top">
                      <div className="realm-card-icon" style={{ background: !isUnlocked ? '#64748B' : ch.color }}>
                        {!isUnlocked ? '🔒' : ch.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="realm-step-badge">
                          فصل {ch.id} • {ch.environmentName} {!isUnlocked && '(قفل)'}
                        </div>
                        <h4 className="realm-card-name">{ch.title}</h4>
                      </div>
                      {!isUnlocked ? (
                        <span className="active-tag" style={{ background: '#E2E8F0', color: '#64748B' }}>
                          🔒 قفل
                        </span>
                      ) : isSelected ? (
                        <span className="active-tag">🌟 در حال کاوش</span>
                      ) : null}
                    </div>

                    <p className="realm-card-desc">{ch.desc}</p>

                    <div className="realm-card-progress">
                      <div className="realm-progress-info">
                        <span>{isUnlocked ? `${completedCount} از ${chapterTopics.length} گام تکمیل شده` : 'نیاز به تکمیل فصل قبلی'}</span>
                        <span>{isUnlocked ? `${percent}٪` : '۰٪'}</span>
                      </div>
                      <div className="realm-progress-track">
                        <div
                          className="realm-progress-fill"
                          style={{
                            width: `${isUnlocked ? percent : 0}%`,
                            background: !isUnlocked ? '#94A3B8' : ch.accentColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                type="button"
                className="close-modal-btn"
                style={{ width: '100%', maxWidth: '280px' }}
                onClick={() => setShowRealmAtlasModal(false)}
              >
                بستن نقشه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          IN-LESSON / QUIZ FULLSCREEN CONTAINER
          ======================================================== */}
      {(activeTopic || isEndlessActive) && currentQuestion && (
        <div className="tizhooshan-quiz-modal">
          {/* Top Progress Bar and Exit Controls */}
          <div className="quiz-header-bar">
            <button
              type="button"
              className="quiz-exit-btn"
              onClick={() => {
                playSound('click')
                setActiveTopic(null)
                setIsEndlessActive(false)
              }}
              title="خروج از درس"
            >
              ✕
            </button>

            <div className="quiz-progress-track">
              <div
                className="quiz-progress-fill"
                style={{
                  width: isEndlessActive
                    ? `${Math.min(100, ((currentQIndex + 1) % 10) * 10)}%`
                    : `${((currentQIndex + (isAnswerChecked && isCorrect ? 1 : 0)) / (activeTopic?.questions.length || 1)) * 100}%`,
                }}
              />
            </div>

            <div className="quiz-hearts-display" title="قلب‌های باقیمانده">
              <span className="heart-icon">❤️</span>
              <span className="heart-count">{progress.hearts}</span>
            </div>
          </div>

          {!quizFinished ? (
            <div className="quiz-card-body">
              {/* Question Meta Badge */}
              <div className="q-badge-header">
                <span className="q-difficulty-pill">
                  {currentQuestion.difficulty === 'آسان'
                    ? '🟢 سطح آسان'
                    : currentQuestion.difficulty === 'متوسط'
                    ? '🟡 سطح متوسط'
                    : '🔴 سطح پیشرفته'}{' '}
                  (+{currentQuestion.xp} XP)
                </span>

                <div className="q-action-tools">
                  <button
                    type="button"
                    className="lifeline-pill-btn"
                    disabled={eliminatedOptions.length > 0 || isAnswerChecked}
                    onClick={handleUseLifeline5050}
                    title="حذف دو گزینه نادرست (۵۰/۵۰)"
                  >
                    ✂️ ۵۰/۵۰
                  </button>

                  <span className="q-progress-text">
                    {isEndlessActive
                      ? `سوال بی‌پایان #${currentQIndex + 1}`
                      : `سوال ${currentQIndex + 1} از ${activeTopic?.questions.length}`}
                  </span>
                </div>
              </div>

              {/* Question Prompt with Owl Mascot speech */}
              <div className="q-bubble-box">
                <div className="owl-mini">{mascotFeedback.icon}</div>
                <div className="q-speech-wrapper">
                  <span className="mascot-speech-bubble">{mascotFeedback.text}</span>
                  <h3 className="q-text-prompt">{currentQuestion.question}</h3>
                </div>
              </div>

              {/* Key Concept Hint */}
              <div className="hint-expander">
                <button
                  type="button"
                  className="hint-toggle-btn"
                  onClick={() => setShowHint(!showHint)}
                >
                  <span>💡</span> {showHint ? 'بستن راهنما' : 'راهنمایی و مفهوم کلیدی'}
                </button>
                {showHint && (
                  <div className="hint-text-panel">
                    {activeTopic?.lesson_summary || currentQuestion.explanation}
                  </div>
                )}
              </div>

              {/* Options Grid */}
              <div className="options-grid">
                {currentQuestion.options.map((option, optIdx) => {
                  const isSelected = selectedOption === optIdx
                  const isEliminated = eliminatedOptions.includes(optIdx)
                  const letters = ['الف', 'ب', 'ج', 'د']

                  let stateClass = ''
                  if (isAnswerChecked) {
                    if (optIdx === currentQuestion.correct_index) {
                      stateClass = 'correct'
                    } else if (isSelected && !isCorrect) {
                      stateClass = 'wrong'
                    }
                  } else if (isSelected) {
                    stateClass = 'selected'
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      className={`duo-option-card ${stateClass} ${
                        isEliminated ? 'eliminated' : ''
                      }`}
                      disabled={isAnswerChecked || isEliminated}
                      onClick={() => {
                        handleCheckAnswer(optIdx)
                      }}
                    >
                      <span className="opt-letter">{letters[optIdx]}</span>
                      <span className="opt-text">{isEliminated ? '--- حذف شد ---' : option}</span>
                      {isAnswerChecked && optIdx === currentQuestion.correct_index && (
                        <span className="opt-check" style={{ color: '#16A34A' }}>✓</span>
                      )}
                      {isAnswerChecked && isSelected && !isCorrect && (
                        <span className="opt-check" style={{ color: '#DC2626' }}>✕</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Sticky Bottom Action Drawer */}
              {isAnswerChecked && (
                <div
                  className={`quiz-footer-drawer ${
                    isCorrect ? 'correct-drawer' : 'wrong-drawer'
                  }`}
                >
                  <div className="feedback-content">
                    <div className="feedback-info">
                      <div className="feedback-title">
                        {isCorrect ? (
                          <>
                            <span className="feedback-icon">🎉</span>
                            <span>آفرین! پاسخ کاملاً درسته!</span>
                            <span className="xp-gain-badge">
                              +{currentQuestion.xp + (comboCount >= 3 ? 10 : comboCount === 2 ? 5 : 0)}{' '}
                              XP
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="feedback-icon">❌</span>
                            <span>پاسخ اشتباه بود!</span>
                          </>
                        )}
                      </div>
                      <div className="feedback-explanation">
                        <strong>تحلیل تکنیک حل: </strong>
                        {currentQuestion.explanation}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`duo-continue-btn ${isCorrect ? 'green-btn' : 'red-btn'}`}
                      onClick={handleNextQuestion}
                    >
                      {isEndlessActive ? 'سوال بعدی بی‌پایان ♾️' : 'ادامه ←'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Celebration Screen */
            <div className="quiz-celebration-container">
              <div className="celebration-animation">
                <span className="trophy-big">🏆</span>
                <div className="stars-row">⭐️ ⭐️ ⭐️</div>
              </div>

              <h2 className="celebration-title">درس با موفقیت تکمیل شد!</h2>
              <p className="celebration-sub">
                مهارت «{activeTopic?.topic}» با موفقیت تقویت شد!
              </p>

              <div className="celebration-stats-grid">
                <div className="celeb-card xp">
                  <span className="celeb-val">+{sessionXpEarned}</span>
                  <span className="celeb-lbl">امتیاز XP کسب‌شده</span>
                </div>
                <div className="celeb-card accuracy">
                  <span className="celeb-val">
                    {activeTopic
                      ? Math.round((sessionCorrectCount / activeTopic.questions.length) * 100)
                      : 100}
                    ٪
                  </span>
                  <span className="celeb-lbl">دقت پاسخگویی</span>
                </div>
                <div className="celeb-card next">
                  <span className="celeb-val">مرحله بعد</span>
                  <span className="celeb-lbl">قفل باز شد 🔓</span>
                </div>
              </div>

              <button
                type="button"
                className="celeb-finish-btn"
                onClick={() => {
                  playSound('click')
                  setActiveTopic(null)
                  setIsEndlessActive(false)
                }}
              >
                بازگشت به نقشه یادگیری 🦉
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
