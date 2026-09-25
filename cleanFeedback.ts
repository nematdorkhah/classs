/**
 * Sanitizes educational feedback from teacher notes and report cards.
 * Strips out system instructions, AI prompts, JSON strings, and code blocks,
 * preserving only the pure, warm, and encouraging educational feedback.
 */
export function sanitizeTeacherFeedback(text: string | null | undefined): string {
  if (!text) return ''
  let cleaned = String(text).trim()

  // 1. If it's a JSON string or contains JSON, extract the note
  if (
    cleaned.startsWith('{') ||
    cleaned.includes('"teacherSummaryNote"') ||
    cleaned.includes('"summary"') ||
    cleaned.includes('"teacherNotes"')
  ) {
    try {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const candidate =
          parsed.teacherSummaryNote ||
          parsed.teacherNotes ||
          parsed.summary ||
          parsed.feedback ||
          parsed.note
        if (candidate && typeof candidate === 'string') {
          cleaned = candidate
        }
      }
    } catch {
      // Fallback regex extraction if malformed JSON
      const noteMatch = cleaned.match(/"teacherSummaryNote"\s*:\s*"([^"]+)"/)
      if (noteMatch && noteMatch[1]) {
        cleaned = noteMatch[1]
      }
    }
  }

  // 2. Remove markdown code blocks
  cleaned = cleaned.replace(/```(?:json)?[\s\S]*?```/g, '').trim()

  // 3. Remove prompt commands and instruction patterns
  const instructionPatterns = [
    /شما آموزگار مهربان.*?(?:هستید|باشید)[.،:\n]/gi,
    /نام شما آموزگار کلاس است[.،:\n]/gi,
    /دانش‌آموز به نام.*?(?:شرکت کرده است|است)[.،:\n]/gi,
    /وظایف شما:.*?(?=\n[۱-۹]|\n[A-Z]|\n\n|$)/gis,
    /اطلاعات سوالات، بارم.*?(?=\n\n|$)/gis,
    /خروجی صرفاً JSON.*?(?=\n\n|$)/gis,
    /پاسخ را صرفاً به صورت.*?(?=\n\n|$)/gis,
    /قوانین و دستورالعمل‌ها:?.*?(?=\n\n|$)/gis,
    /دستورات سیستم:?.*?(?=\n\n|$)/gis,
    /System Instructions?:?.*?(?=\n\n|$)/gis,
    /Prompt:?.*?(?=\n\n|$)/gis,
    /Role:?.*?(?=\n\n|$)/gis,
    /\{\s*"grades"[\s\S]*?\}/gis,
    /\{\s*"id":[\s\S]*?\}/gis,
    /"teacherSummaryNote"\s*:\s*"?/gi,
  ]


  for (const pattern of instructionPatterns) {
    cleaned = cleaned.replace(pattern, '')
  }

  // 4. Strip stray brackets or quotes at ends
  cleaned = cleaned.replace(/^[\{\}\[\]"'\s]+|[\{\}\[\]"'\s]+$/g, '').trim()

  return cleaned
}
