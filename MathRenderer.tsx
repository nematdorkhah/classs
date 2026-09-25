import React from 'react'
import katex from 'katex'
import { toPersianDigits, toEnglishDigits } from '../utils/persianNumbers'

interface MathRendererProps {
  text: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Standard Math & Fraction Renderer for Grade 6 Mathematics
 * Handles:
 * - Proper horizontal fraction bars without RTL text-inversion or scrambling
 * - Mixed numbers (e.g. ۲ ۳/۴ or ۲ و ۳/۴ -> 2 and 3/4)
 * - Safe extraction of \frac{...}{...} without passing Persian sentences to KaTeX
 * - Standard KaTeX rendering for LaTeX formulas ($...$, \sqrt, powers)
 * - Mathematical operators (×, ÷, ≤, ≥, ≠, ±)
 */
export default function MathRenderer({ text, className = '', style = {} }: MathRendererProps) {
  if (!text) return null

  // 1. Normalize common symbol shortcuts before parsing
  let normalized = text
    .replace(/\s*\*\s*/g, ' × ')
    .replace(/\s*<=\s*/g, ' ≤ ')
    .replace(/\s*>=\s*/g, ' ≥ ')
    .replace(/\s*!=\s*/g, ' ≠ ')
    .replace(/\s*\+-\s*/g, ' ± ')
    .replace(/\u2044/g, '/') // Unicode fraction slash to standard slash

  // 2. Helper to safely render KaTeX string
  const renderKaTeX = (latex: string, displayMode = false) => {
    try {
      // KaTeX math mode only accepts ASCII numbers (0-9). Convert Persian digits inside LaTeX to ASCII.
      const cleanLatex = toEnglishDigits(latex)
      const html = katex.renderToString(cleanLatex, {
        displayMode,
        throwOnError: false,
        output: 'html',
      })
      return (
        <span
          className="katex-rendered-block"
          style={{
            direction: 'ltr',
            display: displayMode ? 'block' : 'inline-block',
            margin: displayMode ? '8px 0' : '0 3px',
            verticalAlign: 'middle',
            unicodeBidi: 'isolate',
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    } catch {
      return <span>{toPersianDigits(latex)}</span>
    }
  }

  // 3. Render a single clean Persian/Arabic fractional element with horizontal line
  const renderFractionElement = (
    key: string | number,
    wholeNum: string | null,
    numerator: string,
    denominator: string,
    isNegative = false
  ) => {
    return (
      <span
        key={key}
        className="math-fraction-wrapper"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          verticalAlign: 'middle',
          margin: '0 4px',
          direction: 'rtl',
          unicodeBidi: 'isolate',
          lineHeight: 1,
        }}
      >
        {/* Negative sign if applicable */}
        {isNegative && (
          <span style={{ fontWeight: 900, fontSize: '1.1em', marginLeft: 3 }}>-</span>
        )}

        {/* Whole number for mixed fractions (e.g., ۲ ۳/۴ or ۲ و ۳/۴) */}
        {wholeNum && (
          <span
            className="math-fraction-whole"
            style={{
              fontWeight: 800,
              fontSize: '1.05em',
              marginLeft: 4,
              color: 'inherit',
            }}
          >
            {toPersianDigits(wholeNum)}
          </span>
        )}

        {/* Horizontal fraction stack: Numerator on top, line in middle, Denominator on bottom */}
        <span
          className="math-fraction-stack"
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            verticalAlign: 'middle',
            textAlign: 'center',
            lineHeight: 1.15,
            fontSize: '0.94em',
            padding: '0 3px',
          }}
        >
          <span
            className="math-fraction-num"
            style={{
              borderBottom: '2px solid currentColor',
              paddingBottom: 2,
              paddingLeft: 4,
              paddingRight: 4,
              fontWeight: 800,
              display: 'block',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {toPersianDigits(numerator.trim())}
          </span>
          <span
            className="math-fraction-den"
            style={{
              paddingTop: 2,
              paddingLeft: 4,
              paddingRight: 4,
              fontWeight: 800,
              display: 'block',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {toPersianDigits(denominator.trim())}
          </span>
        </span>
      </span>
    )
  }

  // 4. Extract \frac{...}{...} inside text without passing the rest of the sentence into KaTeX
  const parseLatexFractions = (content: string, baseKey: string): React.ReactNode[] => {
    const fracRegex = /(-)?\\frac\{([^{}]+)\}\{([^{}]+)\}/g
    if (!fracRegex.test(content)) {
      return parsePlainFractions(content, baseKey)
    }

    fracRegex.lastIndex = 0
    const elements: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = fracRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index)
        elements.push(...parsePlainFractions(textBefore, `${baseKey}-b-${match.index}`))
      }

      const isNeg = Boolean(match[1])
      const num = match[2]
      const den = match[3]
      elements.push(renderFractionElement(`${baseKey}-frac-${match.index}`, null, num, den, isNeg))
      lastIndex = fracRegex.lastIndex
    }

    if (lastIndex < content.length) {
      const textAfter = content.substring(lastIndex)
      elements.push(...parsePlainFractions(textAfter, `${baseKey}-after`))
    }

    return elements
  }

  // 5. Parse plain-text fractions and mixed numbers (e.g. ۲ ۳/۴ or ۲ و ۳/۴ or ۳/۴ or 3/4)
  const parsePlainFractions = (content: string, baseKey: string): React.ReactNode[] => {
    // Regex for mixed number or single fraction:
    // Match optional integer (with optional "و") followed by fraction: (e.g. "۲ ۳/۴" or "۲ و ۳/۴" or "۳/۴")
    const mixedOrFracRegex = /(?:(\d+|[۰-۹]+)(?:\s*(?:و)?\s+))?(\d+|[۰-۹]+)\s*\/\s*(\d+|[۰-۹]+)/g

    if (!mixedOrFracRegex.test(content)) {
      return [toPersianDigits(content)]
    }

    // Reset regex
    mixedOrFracRegex.lastIndex = 0
    const elements: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = mixedOrFracRegex.exec(content)) !== null) {
      // Text before the fraction
      if (match.index > lastIndex) {
        elements.push(toPersianDigits(content.substring(lastIndex, match.index)))
      }

      const whole = match[1] || null
      const num = match[2]
      const den = match[3]

      elements.push(renderFractionElement(`${baseKey}-${match.index}`, whole, num, den))
      lastIndex = mixedOrFracRegex.lastIndex
    }

    // Trailing text
    if (lastIndex < content.length) {
      elements.push(toPersianDigits(content.substring(lastIndex)))
    }

    return elements
  }

  // 6. Tokenizer for text lines
  const parseLine = (line: string, lineKey: number) => {
    // A) If line contains display LaTeX math block $$...$$
    if (line.includes('$$')) {
      const parts = line.split('$$')
      return parts.map((part, pIdx) => {
        if (pIdx % 2 === 1) {
          return <React.Fragment key={pIdx}>{renderKaTeX(part, true)}</React.Fragment>
        }
        return <React.Fragment key={pIdx}>{parseLine(part, pIdx)}</React.Fragment>
      })
    }

    // B) If line contains inline LaTeX $...$
    if (line.includes('$')) {
      const parts = line.split('$')
      return parts.map((part, pIdx) => {
        if (pIdx % 2 === 1) {
          return <React.Fragment key={pIdx}>{renderKaTeX(part, false)}</React.Fragment>
        }
        return <React.Fragment key={pIdx}>{parseLatexFractions(part, `inline-${lineKey}-${pIdx}`)}</React.Fragment>
      })
    }

    // C) Line without dollar signs but possibly containing \frac or plain fractions
    return parseLatexFractions(line, `line-${lineKey}`)
  }

  // Handle multi-line strings
  const lines = normalized.split('\n')

  return (
    <span
      className={`math-rendered-root ${className}`}
      style={{
        direction: 'rtl',
        display: 'inline',
        lineHeight: 1.9,
        ...style,
      }}
    >
      {lines.map((line, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <br />}
          {parseLine(line, idx)}
        </React.Fragment>
      ))}
    </span>
  )
}

