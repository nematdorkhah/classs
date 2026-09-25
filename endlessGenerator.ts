// Dynamic procedural question generator for endless practice
import { TizhooshanQuestion } from './tizhooshanQuestions'

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
export function toPersianDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => persianDigits[Number(d)])
}

// 1. Endless Arithmetic Sequence Pattern
function generateSequenceQuestion(): TizhooshanQuestion {
  const type = randInt(1, 4)
  let seq: number[] = []
  let nextVal = 0
  let explanation = ''
  let difficulty: 'آسان' | 'متوسط' | 'سخت' = 'آسان'
  let xp = 15

  if (type === 1) {
    // Linear arithmetic: +d (d between 3 and 12)
    const start = randInt(2, 20)
    const step = randInt(3, 9)
    seq = [start, start + step, start + 2 * step, start + 3 * step]
    nextVal = start + 4 * step
    explanation = `در این الگو در هر گام مقدار ${step} به عدد قبلی اضافه می‌شود: ${seq[3]} + ${step} = ${nextVal}`
    difficulty = 'آسان'
    xp = 15
  } else if (type === 2) {
    // Increasing step: +2, +3, +4, +5...
    const start = randInt(1, 10)
    let cur = start
    seq = [cur]
    const stepBase = randInt(2, 4)
    for (let i = 0; i < 4; i++) {
      cur += stepBase + i
      seq.push(cur)
    }
    const lastStep = stepBase + 4
    nextVal = cur + lastStep
    explanation = `الگوی فاصله‌ها به صورت یکی یکی در حال افزایش است (+${stepBase}، +${stepBase + 1}، +${stepBase + 2}، +${stepBase + 3}). بنابراین در گام بعد باید ${lastStep} به ${seq[seq.length - 1]} اضافه شود: ${nextVal}`
    difficulty = 'متوسط'
    xp = 25
  } else if (type === 3) {
    // Doubling or times N
    const multiplier = randInt(2, 3)
    const start = randInt(2, 5)
    seq = [start, start * multiplier, start * multiplier ** 2, start * multiplier ** 3]
    nextVal = start * multiplier ** 4
    explanation = `در هر مرحله عدد در ${multiplier} ضرب می‌شود: ${seq[3]} × ${multiplier} = ${nextVal}`
    difficulty = 'متوسط'
    xp = 25
  } else {
    // Alternating addition: +a, +b, +a, +b...
    const a = randInt(2, 6)
    const b = randInt(7, 12)
    const start = randInt(3, 15)
    seq = [start, start + a, start + a + b, start + 2 * a + b]
    nextVal = seq[3] + b
    explanation = `الگو به صورت یکی در میان +${a} و سپس +${b} پیش می‌رود. بعد از اضافه شدن ${a} نوبت اضافه شدن ${b} است: ${seq[3]} + ${b} = ${nextVal}`
    difficulty = 'سخت'
    xp = 35
  }

  const wrong1 = nextVal + randInt(1, 4)
  const wrong2 = Math.max(1, nextVal - randInt(1, 4))
  const wrong3 = nextVal + randInt(5, 9)

  const choices = [nextVal, wrong1, wrong2, wrong3]
  const uniqueChoices = Array.from(new Set(choices))
  while (uniqueChoices.length < 4) {
    uniqueChoices.push(nextVal + uniqueChoices.length * 3)
  }

  const shuffled = shuffle(uniqueChoices)
  const correctIdx = shuffled.indexOf(nextVal)

  return {
    id: Date.now() + randInt(1, 1000),
    question: `در الگوی مقابل عدد بعدی کدام است؟\n${seq.join(' ، ')} ، ؟`,
    options: shuffled.map(String),
    correct_index: correctIdx,
    explanation,
    difficulty,
    xp,
  }
}

// 2. Endless Calendar & Weekday Problem
function generateCalendarQuestion(): TizhooshanQuestion {
  const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه']
  const startDayIdx = randInt(0, 6)
  const daysLater = randInt(15, 60)
  const targetDayIdx = (startDayIdx + (daysLater % 7)) % 7

  const qText = `اگر امروز «${days[startDayIdx]}» باشد، دقیقاً ${daysLater} روز دیگر چه روزی از هفته خواهد بود؟`

  const targetDay = days[targetDayIdx]
  const wrongChoices = days.filter((d) => d !== targetDay).slice(0, 3)
  const options = shuffle([targetDay, ...wrongChoices])

  const quotient = Math.floor(daysLater / 7)
  const remainder = daysLater % 7
  const explanation = `هر هفته ۷ روز دارد. ${daysLater} تقسیم بر ۷ برابر است با ${quotient} هفته کامل با باقیمانده ${remainder}. بنابراین باید از ${days[startDayIdx]} به تعداد ${remainder} روز جلو برویم که به «${targetDay}» می‌رسیم.`

  return {
    id: Date.now() + randInt(1, 1000),
    question: qText,
    options,
    correct_index: options.indexOf(targetDay),
    explanation,
    difficulty: daysLater > 35 ? 'متوسط' : 'آسان',
    xp: 20,
  }
}

// 3. Endless Clock Angle and Mirror Math
function generateClockQuestion(): TizhooshanQuestion {
  const hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  const h = hours[randInt(0, hours.length - 1)]

  // Angle at sharp hour h:00
  // Each hour on clock is 30 degrees (360 / 12)
  const rawAngle = h * 30
  const smallerAngle = rawAngle > 180 ? 360 - rawAngle : rawAngle

  const qText = `در ساعت دقیقاً ${h}:۰۰ (راس ساعت ${h})، کوچک‌ترین زاویه بین دو عقربه ساعت‌شمار و دقیقه‌شمار چند درجه است؟`

  const correctOpt = `${smallerAngle} درجه`
  const w1 = `${(smallerAngle + 30) % 360} درجه`
  const w2 = `${Math.abs(smallerAngle - 30)} درجه`
  const w3 = `${180 - smallerAngle > 0 ? 180 - smallerAngle : 90} درجه`

  const options = shuffle(Array.from(new Set([correctOpt, w1, w2, w3])))
  while (options.length < 4) {
    options.push(`${randInt(40, 170)} درجه`)
  }

  const explanation = `صفحه ساعت ۳۶۰ درجه است که به ۱۲ بخش مساوی تقسیم شده، یعنی هر یک ساعت برابر ۳۰ درجه است. در ساعت ${h}:۰۰ عقربه ساعت روی ${h} و دقیقه روی ۱۲ است، پس زاویه برابر است با ${smallerAngle} درجه.`

  return {
    id: Date.now() + randInt(1, 1000),
    question: qText,
    options,
    correct_index: options.indexOf(correctOpt),
    explanation,
    difficulty: 'آسان',
    xp: 15,
  }
}

// 4. Endless Missing Math Arithmetic Mystery
function generateMissingMathQuestion(): TizhooshanQuestion {
  const a = randInt(3, 9)
  const b = randInt(4, 8)
  const c = randInt(5, 25)
  // Formula: a * ? + b = result
  const target = randInt(2, 9)
  const result = a * target + b

  const qText = `در تساوی حسابی مقابل به جای علامت سؤال (؟) چه عددی باید قرار گیرد؟\n(${a} × ؟) + ${b} = ${result}`

  const options = shuffle([
    String(target),
    String(target + 1),
    String(Math.max(1, target - 1)),
    String(target + 2),
  ])

  const explanation = `برای حل این تساوی ابتدا ${b} را از ${result} کم می‌کنیم: ${result} - ${b} = ${result - b}. سپس حاصل را بر ${a} تقسیم می‌کنیم: ${result - b} ÷ ${a} = ${target}.`

  return {
    id: Date.now() + randInt(1, 1000),
    question: qText,
    options,
    correct_index: options.indexOf(String(target)),
    explanation,
    difficulty: 'آسان',
    xp: 15,
  }
}

// 5. Endless Dice Opposites Rule
function generateDiceQuestion(): TizhooshanQuestion {
  const topFace = randInt(1, 6)
  const opposite = 7 - topFace
  const qText = `در یک تاس استاندارد و سالم، اگر عدد وجه بالایی «${topFace}» باشد، عدد وجه پایینی (روبرو) آن کدام است؟`

  const correct = String(opposite)
  const choices = shuffle(['۱', '۲', '۳', '۴', '۵', '۶'].filter((c) => c !== String(topFace)))
  const options = shuffle([correct, choices[0], choices[1], choices[2]])

  const explanation = `در تمام تاس‌های استاندارد تیزهوشان و ریاضی، مجموع دو وجه روبروی هم همواره برابر ۷ است. پس: ۷ - ${topFace} = ${opposite}.`

  return {
    id: Date.now() + randInt(1, 1000),
    question: qText,
    options,
    correct_index: options.indexOf(correct),
    explanation,
    difficulty: 'آسان',
    xp: 10,
  }
}

// 6. Endless Word & Synonym Pairs
const wordPairsBank = [
  { w1: 'آغاز', w2: 'شروع', type: 'هم‌معنی', dist: 'پایان' },
  { w1: 'تاریک', w2: 'روشن', type: 'متضاد', dist: 'سیاه' },
  { w1: 'دانا', w2: 'نادان', type: 'متضاد', dist: 'عالم' },
  { w1: 'شجاع', w2: 'دلیر', type: 'هم‌معنی', dist: 'ترسو' },
  { w1: 'آسان', w2: 'دشوار', type: 'متضاد', dist: 'ساده' },
  { w1: 'فراز', w2: 'فرود', type: 'متضاد', dist: 'بلندی' },
  { w1: 'شادمان', w2: 'خوشحال', type: 'هم‌معنی', dist: 'غمگین' },
  { w1: 'فربه', w2: 'لاغر', type: 'متضاد', dist: 'چاق' },
  { w1: 'خسیس', w2: 'بخشنده', type: 'متضاد', dist: 'ناخن‌خشک' },
  { w1: 'کهن', w2: 'قدیمی', type: 'هم‌معنی', dist: 'نو' },
  { w1: 'پیروزی', w2: 'شکست', type: 'متضاد', dist: 'موفقیت' },
]

function generateWordQuestion(): TizhooshanQuestion {
  const item = wordPairsBank[randInt(0, wordPairsBank.length - 1)]
  const isOpposite = item.type === 'متضاد'

  const qText = isOpposite
    ? `متضاد و مخالف کلمه «${item.w1}» کدام گزینه است؟`
    : `کدام کلمه هم‌معنی و مترادف با «${item.w1}» است؟`

  const correct = item.w2
  const fake1 = item.dist
  const otherItems = wordPairsBank.filter((x) => x.w1 !== item.w1)
  const fake2 = otherItems[0].w1
  const fake3 = otherItems[1].w2

  const options = shuffle([correct, fake1, fake2, fake3])

  return {
    id: Date.now() + randInt(1, 1000),
    question: qText,
    options,
    correct_index: options.indexOf(correct),
    explanation: `کلمه «${item.w1}» و «${item.w2}» رابطه ${item.type} دارند.`,
    difficulty: 'آسان',
    xp: 10,
  }
}

// 7. Endless Counting Shapes Formula
function generateCountingShapesQuestion(): TizhooshanQuestion {
  const n = randInt(3, 6)
  // If a triangle is divided into n parts with rays from apex: total triangles = n * (n + 1) / 2
  const total = (n * (n + 1)) / 2

  const qText = `یک مثلث بزرگ با رسم خطوطی از رأس بالا به قاعده پایین، به ${n} بخش کوچک‌تر تقسیم شده است. در مجموع چند مثلث در این شکل دیده می‌شود؟`

  const correct = `${total} مثلث`
  const w1 = `${total + n} مثلث`
  const w2 = `${Math.max(1, total - n)} مثلث`
  const w3 = `${n * 2} مثلث`

  const options = shuffle([correct, w1, w2, w3])
  const explanation = `فرمول شمارش مثلث‌های هم‌رأس: n × (n + 1) ÷ ۲ است. چون قاعده به ${n} قسمت تقسیم شده، پس: ${n} × ${n + 1} ÷ ۲ = ${total} مثلث.`

  return {
    id: Date.now() + randInt(1, 1000),
    question: qText,
    options,
    correct_index: options.indexOf(correct),
    explanation,
    difficulty: 'متوسط',
    xp: 20,
  }
}

// 8. Endless Permutation Rank Question (Model of Question 13 in Sampad 1405-1406)
function generatePermutationRankQuestion(): TizhooshanQuestion {
  const digitsPool = [
    [1, 2, 3, 4],
    [2, 3, 4, 5],
    [1, 3, 5, 7],
    [2, 4, 6, 8],
  ]
  const digits = digitsPool[randInt(0, digitsPool.length - 1)]
  // All permutations of 4 digits = 24
  // Let's generate all 24 numbers sorted
  const perms: number[] = []
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (j === i) continue
      for (let k = 0; k < 4; k++) {
        if (k === i || k === j) continue
        for (let l = 0; l < 4; l++) {
          if (l === i || l === j || l === k) continue
          const num = digits[i] * 1000 + digits[j] * 100 + digits[k] * 10 + digits[l]
          perms.push(num)
        }
      }
    }
  }
  perms.sort((a, b) => a - b)

  // Pick target rank k (e.g. 13th, 14th, 15th, 16th, 19th)
  const rank = [13, 14, 15, 16, 18, 19, 20][randInt(0, 6)]
  const targetNum = perms[rank - 1]

  const persianRank = ({
    13: 'سیزدهمین',
    14: 'چهاردهمین',
    15: 'پانزدهمین',
    16: 'شانزدهمین',
    18: 'هجدهمین',
    19: 'نوزدهمین',
    20: 'بیستمین',
  } as Record<number, string>)[rank] || `${rank}ـمین`

  const qText = `تمام عددهای ۴ رقمی را در نظر بگیرید که در آنها هر یک از ارقام ${digits.join('، ')} دقیقاً یک بار استفاده شده است. اگر این عددها را از کوچک به بزرگ مرتب کنیم، ${persianRank} عدد کدام است؟`

  const correct = String(targetNum)
  const fake1 = String(perms[(rank - 2 + perms.length) % perms.length])
  const fake2 = String(perms[rank % perms.length])
  const fake3 = String(perms[(rank + 2) % perms.length])

  const options = shuffle(Array.from(new Set([correct, fake1, fake2, fake3])))
  while (options.length < 4) {
    options.push(String(targetNum + randInt(10, 50)))
  }

  const firstDigitIndex = Math.floor((rank - 1) / 6)
  const firstDigit = digits[firstDigitIndex]
  const explanation = `با ۴ رقم غیرتکراری مجموعاً ۲۴ عدد ۴ رقمی می‌توان ساخت (!۴ = ۲۴).
به ازای هر رقم شروع‌کننده، دقیقاً ۶ عدد وجود دارد (!۳ = ۶).
- ۶ عدد اول با رقم ${digits[0]} شروع می‌شوند (رتبه‌های ۱ تا ۶)
- ۶ عدد دوم با رقم ${digits[1]} شروع می‌شوند (رتبه‌های ۷ تا ۱۲)
- ۶ عدد سوم با رقم ${digits[2]} شروع می‌شوند (رتبه‌های ۱۳ تا ۱۸)
بنابراین ${persianRank} عدد، با رقم ${firstDigit} آغاز می‌شود و با شمارش ترتیبی دقیقاً برابر با ${targetNum} خواهد بود.`

  return {
    id: Date.now() + randInt(1, 1000),
    question: qText,
    options,
    correct_index: options.indexOf(correct),
    explanation,
    difficulty: 'سخت',
    xp: 35,
  }
}

// 9. Endless Wall Sockets & Multi-strips (Model of Question 16 in Sampad 1405-1406)
function generatePowerOutletsQuestion(): TizhooshanQuestion {
  const wallSockets = randInt(2, 4)
  const threeStrips = randInt(4, 8)
  const fourStrips = randInt(5, 10)

  // Each 3-way strip plugs into 1 socket and gives 3 sockets => net gain = +2
  // Each 4-way strip plugs into 1 socket and gives 4 sockets => net gain = +3
  const maxAppliances = wallSockets + threeStrips * 2 + fourStrips * 3

  const qText = `در یک خانه ${wallSockets} پریز برق دیواری، ${threeStrips} عدد سه‌راهی برق و ${fourStrips} عدد چهارراهی برق موجود است. با استفاده از آنها حداکثر چند وسیله برقی را می‌توان به طور هم‌زمان به برق وصل کرد؟`

  const correct = `${maxAppliances} وسیله`
  const w1 = `${maxAppliances + randInt(2, 5)} وسیله`
  const w2 = `${Math.max(10, maxAppliances - randInt(2, 6))} وسیله`
  const w3 = `${wallSockets * 3 + threeStrips + fourStrips} وسیله`

  const options = shuffle(Array.from(new Set([correct, w1, w2, w3])))
  while (options.length < 4) {
    options.push(`${maxAppliances + options.length * 3} وسیله`)
  }

  const explanation = `تکنیک طلایی:
۱) در ابتدا ${wallSockets} پریز دیواری داریم.
۲) هر سه‌راهی ۱ سوکت را اشغال کرده و ۳ سوکت ایجاد می‌کند، یعنی سود خالص هر سه‌راهی ۲ سوکت است (${threeStrips} × ۲ = ${threeStrips * 2}+).
۳) هر چهارراهی ۱ سوکت را اشغال کرده و ۴ سوکت ایجاد می‌کند، یعنی سود خالص هر چهارراهی ۳ سوکت است (${fourStrips} × ۳ = ${fourStrips * 3}+).
بنابراین حداکثر وسایل برقی: ${wallSockets} + ${threeStrips * 2} + ${fourStrips * 3} = ${maxAppliances} وسیله.`

  return {
    id: Date.now() + randInt(1, 1000),
    question: qText,
    options,
    correct_index: options.indexOf(correct),
    explanation,
    difficulty: 'متوسط',
    xp: 25,
  }
}

// 10. Endless Research Groups & Membership Formula (Model of Question 26 in Sampad 1405-1406)
function generateGroupMembershipQuestion(): TizhooshanQuestion {
  // We want: (numGroups * membersPerGroup) % groupsPerStudent === 0
  const configs = [
    { groups: 20, members: 4, perStudent: 5, ans: 16 },
    { groups: 15, members: 4, perStudent: 3, ans: 20 },
    { groups: 18, members: 5, perStudent: 6, ans: 15 },
    { groups: 24, members: 3, perStudent: 4, ans: 18 },
    { groups: 30, members: 4, perStudent: 6, ans: 20 },
  ]
  const item = configs[randInt(0, configs.length - 1)]

  const qText = `دانش‌آموزان یک پایه تحصیلی، ${item.groups} گروه پژوهشی تشکیل داده‌اند، به‌طوری‌که هر دانش‌آموز دقیقاً در ${item.perStudent} گروه عضویت دارد و هر گروه دقیقاً شامل ${item.members} عضو است. این پایه در مجموع چند دانش‌آموز دارد؟`

  const correct = `${item.ans} دانش‌آموز`
  const w1 = `${item.ans + 4} دانش‌آموز`
  const w2 = `${item.ans - 3 > 0 ? item.ans - 3 : item.ans + 6} دانش‌آموز`
  const w3 = `${item.groups} دانش‌آموز`

  const options = shuffle(Array.from(new Set([correct, w1, w2, w3])))
  while (options.length < 4) {
    options.push(`${item.ans + options.length * 2} دانش‌آموز`)
  }

  const totalSeats = item.groups * item.members
  const explanation = `فرمول شمارش دوطرفه:
تعداد کل عضویت‌ها در گروه‌ها برابر است با: ${item.groups} گروه × ${item.members} نفر = ${totalSeats} عضویت.
از طرفی چون هر دانش‌آموز دقیقاً در ${item.perStudent} گروه عضو است، تعداد دانش‌آموزان برابر است با:
${totalSeats} ÷ ${item.perStudent} = ${item.ans} دانش‌آموز.`

  return {
    id: Date.now() + randInt(1, 1000),
    question: qText,
    options,
    correct_index: options.indexOf(correct),
    explanation,
    difficulty: 'متوسط',
    xp: 25,
  }
}

// 11. Endless Rotated Map Direction (Model of Questions 31-32 in Sampad 1405-1406)
function generateMapRotationQuestion(): TizhooshanQuestion {
  // If a map is rotated 90 degrees clockwise:
  // North (normally Up) points to the Right (East of the image)
  // East (normally Right) points Down (South of the image)
  // South (normally Down) points to the Left (West of the image)
  // West (normally Left) points Up (North of the image)
  const scenarios = [
    {
      action: 'حرکت به سمت بالای تصویر نقشه',
      realDirection: 'غرب واقعی',
      reason: 'وقتی نقشه ۹۰ درجه ساعت‌گرد چرخیده، جهت غرب به سمت بالای صفحه قرار گرفته است.',
    },
    {
      action: 'حرکت به سمت راست تصویر نقشه',
      realDirection: 'شمال واقعی',
      reason: 'وقتی نقشه ۹۰ درجه ساعت‌گرد چرخیده، جهت شمال که معمولاً بالاست، ۹۰ درجه به راست می‌چرخد و به سمت راست صفحه اشاره می‌کند.',
    },
    {
      action: 'حرکت به سمت پایین تصویر نقشه',
      realDirection: 'شرق واقعی',
      reason: 'وقتی نقشه ۹۰ درجه ساعت‌گرد چرخیده، جهت شرق که در سمت راست بود به سمت پایین تصویر چرخیده است.',
    },
    {
      action: 'حرکت به سمت چپ تصویر نقشه',
      realDirection: 'جنوب واقعی',
      reason: 'وقتی نقشه ۹۰ درجه ساعت‌گرد چرخیده، جهت جنوب به سمت چپ صفحه اشاره می‌کند.',
    },
  ]

  const item = scenarios[randInt(0, scenarios.length - 1)]

  const qText = `نقشه‌ای از یک منطقه ۹۰ درجه در جهت عقربه‌های ساعت چرخیده است. اگر فردی روی تصویر این نقشه مستقیماً «${item.action.replace('حرکت به سمت ', '')}» حرکت کند، در دنیای واقعی در کدام جهت جغرافیایی در حال حرکت است؟`

  const correct = item.realDirection
  const pool = ['شمال واقعی', 'جنوب واقعی', 'شرق واقعی', 'غرب واقعی']
  const options = shuffle(pool)

  return {
    id: Date.now() + randInt(1, 1000),
    question: qText,
    options,
    correct_index: options.indexOf(correct),
    explanation: item.reason,
    difficulty: 'سخت',
    xp: 30,
  }
}

// 12. Queue and Position Logic
function generateQueueRankingQuestion(): TizhooshanQuestion {
  const names = ['امیرعلی', 'محمد', 'سروش', 'علیرضا', 'پرهام', 'کیان', 'آرتین', 'مهدی']
  const name = names[randInt(0, names.length - 1)]
  const fromFront = randInt(7, 24)
  const fromBack = randInt(12, 35)
  const total = fromFront + fromBack - 1

  const correct = `${total} نفر`
  const pool = [
    correct,
    `${total + 1} نفر`,
    `${total - 1} نفر`,
    `${total + 2} نفر`,
  ]
  const options = shuffle(pool)

  return {
    id: Date.now() + randInt(1, 1000),
    question: `در یک صف دانش‌آموزی، ${name} از ابتدای صف نفر ${fromFront}ام و از انتهای صف نفر ${fromBack}ام است. در این صف کلاً چند نفر ایستاده‌اند؟`,
    options,
    correct_index: options.indexOf(correct),
    explanation: `فرمول تعیین کل افراد صف: (رتبه از ابتدا + رتبه از انتها) منهای ۱ = (${fromFront} + ${fromBack}) - ۱ = ${total} نفر (زیرا خود ${name} دو بار شمرده شده است).`,
    difficulty: 'متوسط',
    xp: 25,
  }
}

// 13. Speed and Meeting Time
function generateSpeedDistanceQuestion(): TizhooshanQuestion {
  const v1 = randInt(2, 6) * 10 // 20, 30, 40, 50, 60 km/h
  const v2 = randInt(2, 6) * 10 // 20, 30, 40, 50, 60 km/h
  const timeHours = randInt(2, 4) // 2, 3, 4 hours
  const distance = (v1 + v2) * timeHours

  const correct = `${timeHours} ساعت`
  const pool = [
    correct,
    `${timeHours + 1} ساعت`,
    `${timeHours + 2} ساعت`,
    `${Math.max(1, timeHours - 1)} ساعت`,
  ]
  const options = shuffle(pool)

  return {
    id: Date.now() + randInt(1, 1000),
    question: `دو اتومبیل با سرعت‌های ثابت ${v1} و ${v2} کیلومتر بر ساعت از دو شهر به فاصله ${distance} کیلومتر هم‌زمان به سمت یکدیگر حرکت می‌کنند. پس از چند ساعت به یکدیگر می‌رسند؟`,
    options,
    correct_index: options.indexOf(correct),
    explanation: `مجموع سرعت دو متحرک: ${v1} + ${v2} = ${v1 + v2} کیلومتر بر ساعت. زمان رسیدن = فاصله ÷ مجموع سرعت‌ها = ${distance} ÷ ${v1 + v2} = ${timeHours} ساعت.`,
    difficulty: 'متوسط',
    xp: 25,
  }
}

// 14. Fraction Word Riddle
function generateFractionRiddleQuestion(): TizhooshanQuestion {
  const baseBookPages = [120, 180, 240, 300, 360][randInt(0, 4)]
  const readFractionPart = randInt(2, 4) // 1/2, 1/3, 1/4
  const readPages = baseBookPages / readFractionPart
  const remainingPages = baseBookPages - readPages

  const correct = `${remainingPages} صفحه`
  const pool = [
    correct,
    `${readPages} صفحه`,
    `${remainingPages + 20} صفحه`,
    `${Math.max(10, remainingPages - 30)} صفحه`,
  ]
  const options = shuffle(pool)

  return {
    id: Date.now() + randInt(1, 1000),
    question: `دانش‌آموزی یک کتاب ${baseBookPages} صفحه‌ای را شروع کرده و ۱/${readFractionPart} آن را خوانده است. چند صفحه از کتاب باقی مانده است؟`,
    options,
    correct_index: options.indexOf(correct),
    explanation: `صفحات خوانده شده: ${baseBookPages} ÷ ${readFractionPart} = ${readPages} صفحه. صفحات باقی‌مانده: ${baseBookPages} - ${readPages} = ${remainingPages} صفحه.`,
    difficulty: 'آسان',
    xp: 20,
  }
}

// Master Endless Question Generator
export function generateRandomTizhooshanQuestion(): TizhooshanQuestion {
  const generators = [
    generateSequenceQuestion,
    generateCalendarQuestion,
    generateClockQuestion,
    generateMissingMathQuestion,
    generateDiceQuestion,
    generateWordQuestion,
    generateCountingShapesQuestion,
    generatePermutationRankQuestion,
    generatePowerOutletsQuestion,
    generateGroupMembershipQuestion,
    generateMapRotationQuestion,
    generateQueueRankingQuestion,
    generateSpeedDistanceQuestion,
    generateFractionRiddleQuestion,
  ]

  const pick = generators[randInt(0, generators.length - 1)]
  return pick()
}

