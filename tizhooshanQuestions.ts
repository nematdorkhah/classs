import { chapter1Topics } from './chapters/chapter1Verbal'
import { chapter2Topics } from './chapters/chapter2Math'
import { chapter3Topics } from './chapters/chapter3Logic'
import { chapter4Topics } from './chapters/chapter4Spatial'
import { chapter5Topics } from './chapters/chapter5Mechanics'
import { chapter6Topics } from './chapters/chapter6SampadExams'

export interface TizhooshanQuestion {
  id: number
  question: string
  options: string[]
  correct_index: number
  explanation: string
  difficulty: 'آسان' | 'متوسط' | 'سخت'
  xp: number
}

export interface TizhooshanTopic {
  id: string
  chapterId: number
  chapterTitle: string
  chapterIcon: string
  unitNumber: number
  category: 'شروع آسان' | 'کلامی و ادبی' | 'تصویری و فضایی' | 'ریاضی و منطقی' | 'طبیعی و مهارتی' | 'آزمون جامع' | 'دفترچه رسمی' | 'مرور و تثبیت آموخته‌ها'
  topic: string
  icon: string
  lesson_summary: string
  questions: TizhooshanQuestion[]
}

export interface TizhooshanChapter {
  id: number
  title: string
  realmName: string
  environmentName: string
  icon: string
  desc: string
  color: string
  accentColor: string
  bgGradient: string
  cardGradient: string
}

export const tizhooshanChaptersData: TizhooshanChapter[] = [
  {
    id: 1,
    title: 'فصل ۱: هوش کلامی، واژگان و درک مطلب',
    realmName: 'اقلیم هوش کلامی و ادبی',
    environmentName: 'جنگل زمردین واژگان و حکمت',
    icon: '🗣️',
    desc: 'سفر در دنیای ضرب‌المثل‌ها، مترادف‌ها، متضادها، کنایات دقیق، هم‌خانواده‌ها و درک متون مفهومی',
    color: '#10B981',
    accentColor: '#059669',
    bgGradient: 'linear-gradient(180deg, #ECFDF5 0%, #D1FAE5 50%, #F0FDF4 100%)',
    cardGradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  },
  {
    id: 2,
    title: 'فصل ۲: دره عددی و محاسبات هوشمند ریاضی',
    realmName: 'دره محاسبات و منطق عددی',
    environmentName: 'کوهستان لاجوردی ارقام و جایگشت',
    icon: '🔢',
    desc: 'از الگوهای هندسی و حسابی تا شمارش ترکیبیاتی، جایگشت ارقام ۴ رقمی، رقم یکان و کسرها',
    color: '#3B82F6',
    accentColor: '#1D4ED8',
    bgGradient: 'linear-gradient(180deg, #EFF6FF 0%, #DBEAFE 50%, #F0F9FF 100%)',
    cardGradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
  },
  {
    id: 3,
    title: 'فصل ۳: دژ دیدبانی منطق، استدلال و استنتاج',
    realmName: 'دژ دیدبانی منطق و تفکر نقادانه',
    environmentName: 'قلعه کهربایی معماهای کارآگاهی',
    icon: '🕵️',
    desc: 'مسائل راستگو و دروغگو، سن و سال، صف، خویشاوندی، وزن‌کشی با ترازو و جدول مسابقات',
    color: '#F59E0B',
    accentColor: '#D97706',
    bgGradient: 'linear-gradient(180deg, #FFFBEB 0%, #FEF3C7 50%, #FFFDF5 100%)',
    cardGradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  },
  {
    id: 4,
    title: 'فصل ۴: قلمرو هندسه تحلیلی، گسترده و تجسم فضایی',
    realmName: 'شهر هندسه تحلیلی و تجسم فضایی',
    environmentName: 'قلمرو یاقوتی اشکال و مکعب‌ها',
    icon: '📐',
    desc: 'زوایای ساعت، تقارن محوری، مکعب ۳×۳×۳، گسترده‌ها، تاس استاندارد و مساحت رویه مکعب‌های متصل',
    color: '#8B5CF6',
    accentColor: '#6D28D9',
    bgGradient: 'linear-gradient(180deg, #F5F3FF 0%, #EDE9FE 50%, #FAF5FF 100%)',
    cardGradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
  },
  {
    id: '5' as any,
    title: 'فصل ۵: سرزمین مکانیزم‌ها، چرخ‌دنده‌ها و دنیای واقعی',
    realmName: 'کارخانه مکانیزم‌ها و ابزارهای دنیای واقعی',
    environmentName: 'سرزمین فیروزه‌ای چرخ‌دنده‌ها و مدارها',
    icon: '⚙️',
    desc: 'چرخ‌دنده‌ها و تسمه‌ها، جهت‌یابی نقشه چرخیده ۹۰ درجه، سه‌راهی برق و قوانین حرکت',
    color: '#0EA5E9',
    accentColor: '#0284C7',
    bgGradient: 'linear-gradient(180deg, #F0F9FF 0%, #E0F2FE 50%, #F8FAFC 100%)',
    cardGradient: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
  },
  {
    id: 6,
    title: 'فصل ۶: کهکشان فینال و دفترچه‌های رسمی آزمون',
    realmName: 'کهکشان المپیاد و تراز قبولی',
    environmentName: 'قله طلایی آزمون‌های رسمی ورودی تیزهوشان',
    icon: '🏆',
    desc: 'شبیه‌ساز دفترچه‌های واقعی آزمون ورودی همراه با کارنامه و تراز علمی',
    color: '#EC4899',
    accentColor: '#BE185D',
    bgGradient: 'linear-gradient(180deg, #FDF2F8 0%, #FCE7F3 50%, #FFF1F2 100%)',
    cardGradient: 'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)',
  },
]

// Harmonize IDs so that all chapter IDs are numbers
tizhooshanChaptersData[4].id = 5

// Master list of all topics
export const tizhooshanTopicsData: TizhooshanTopic[] = [
  ...chapter1Topics,
  ...chapter2Topics,
  ...chapter3Topics,
  ...chapter4Topics,
  ...chapter5Topics,
  ...chapter6Topics,
]

export function getTopicsForChapter(chapterId: number): TizhooshanTopic[] {
  return tizhooshanTopicsData.filter((t) => t.chapterId === chapterId)
}
