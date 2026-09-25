import React from 'react'

interface SchoolLogoProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Official School Emblem for دبستان حضرت قائم (عج)
 * Faithfully matches the official school logo:
 * - Golden-yellow sun disk with thin outline
 * - 7 lively green leaves sprouting on the upper-right arc
 * - Open book at the base with vibrant cyan/blue wings
 * - Centered deep-purple stylized Persian calligraphy of «قائم» with joyful student figures & white border
 */
export default function SchoolLogo({ size = 88, className = '', style = {} }: SchoolLogoProps) {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        aspectRatio: '1 / 1',
        flexShrink: 0,
        position: 'relative',
        ...style,
      }}
    >
      <svg
        viewBox="0 0 500 500"
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: '100%',
          height: '100%',
          aspectRatio: '1 / 1',
          objectFit: 'contain',
          display: 'block',
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.12))',
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Golden Sun Disk */}
          <radialGradient id="sunGradient" cx="45%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#FFE033" />
            <stop offset="65%" stopColor="#FFCD00" />
            <stop offset="100%" stopColor="#F5B800" />
          </radialGradient>

          {/* Cyan/Blue Open Book Pages */}
          <linearGradient id="bookUpperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#00AEEF" />
          </linearGradient>
          <linearGradient id="bookLowerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#009CD8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>

          {/* Green Leaves */}
          <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="40%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          {/* Purple Calligraphy */}
          <linearGradient id="calligGrad" x1="10%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor="#431E7A" />
            <stop offset="50%" stopColor="#381966" />
            <stop offset="100%" stopColor="#2D1154" />
          </linearGradient>
        </defs>

        {/* 1. Yellow Sun Circle Background */}
        <circle
          cx="250"
          cy="245"
          r="162"
          fill="url(#sunGradient)"
          stroke="#52525B"
          strokeWidth="3.5"
          strokeOpacity="0.5"
        />

        {/* 2. Green Leaves (Sprouting along the upper-right rim) */}
        <g id="greenLeaves" fill="url(#leafGrad)">
          {/* Leaf 1 (Topmost) */}
          <path d="M 292 86 C 310 66 318 110 298 130 C 286 114 284 96 292 86 Z" />
          {/* Leaf 2 */}
          <path d="M 330 96 C 358 80 354 126 328 140 C 318 126 320 106 330 96 Z" />
          {/* Leaf 3 */}
          <path d="M 364 134 C 394 122 386 168 356 174 C 348 154 354 140 364 134 Z" />
          {/* Leaf 4 */}
          <path d="M 390 180 C 420 180 406 220 376 214 C 370 194 380 184 390 180 Z" />
          {/* Leaf 5 */}
          <path d="M 384 230 C 410 242 390 276 364 260 C 364 244 374 234 384 230 Z" />
          {/* Leaf 6 (inner small) */}
          <path d="M 346 170 C 368 158 364 190 342 194 C 336 184 342 174 346 170 Z" />
          {/* Leaf 7 (inner small) */}
          <path d="M 326 210 C 348 204 344 234 324 234 C 316 224 322 214 326 210 Z" />
        </g>

        {/* 3. Open Book at the Base */}
        <g id="openBook">
          {/* Upper left spread wing */}
          <path
            d="M 250 375 C 205 352 135 345 88 350 C 95 378 100 398 105 408 C 150 398 215 410 250 438 Z"
            fill="url(#bookUpperGrad)"
          />
          {/* Lower left spread wing */}
          <path
            d="M 250 438 C 215 410 150 398 105 408 C 108 416 116 426 122 430 C 165 420 220 432 250 452 Z"
            fill="url(#bookLowerGrad)"
          />

          {/* Upper right spread wing */}
          <path
            d="M 250 375 C 295 352 365 345 412 350 C 405 378 400 398 395 408 C 350 398 285 410 250 438 Z"
            fill="url(#bookUpperGrad)"
          />
          {/* Lower right spread wing */}
          <path
            d="M 250 438 C 285 410 350 398 395 408 C 392 416 384 426 378 430 C 335 420 280 432 250 452 Z"
            fill="url(#bookLowerGrad)"
          />

          {/* Center spine highlight */}
          <polygon points="248,370 252,370 252,452 248,452" fill="#FFFFFF" opacity="0.95" />
        </g>

        {/* 4. Foreground Stylized Persian Calligraphy of «قائم» with Figures & White Outline */}
        <g id="calligraphyFigures">
          {/* White outline backdrop to create clean sticker separation */}
          <g fill="none" stroke="#FFFFFF" strokeWidth="15" strokeLinejoin="round" strokeLinecap="round">
            {/* Left child head outline */}
            <circle cx="216" cy="142" r="20" />
            {/* Right child head outline */}
            <circle cx="262" cy="122" r="22" />
            {/* Arms outline */}
            <path d="M 205 168 C 188 152 182 132 192 126 C 202 120 210 136 216 154 Z" />
            <path d="M 272 146 C 288 130 298 110 308 116 C 316 122 302 142 285 158 Z" />
            {/* Main calligraphy body outline */}
            <path
              d="M 220 155 C 235 185 245 205 255 215 C 270 210 280 180 270 150
                 C 260 180 245 195 235 180 C 228 170 224 162 220 155 Z"
            />
            <path
              d="M 215 180 C 180 190 165 220 170 250 C 175 275 195 290 225 295
                 C 200 310 180 335 185 365 C 190 395 220 425 248 438
                 C 240 405 235 370 235 340 C 235 315 245 300 255 295
                 C 265 290 270 275 270 255 C 270 230 255 210 240 200
                 C 230 220 205 235 195 250 C 190 260 195 270 205 270
                 C 220 270 235 255 240 235 C 242 225 230 205 215 180 Z"
            />
            <path
              d="M 255 295 C 275 290 305 295 320 280 C 335 265 335 240 325 220
                 C 315 205 295 205 285 218 C 275 230 275 248 285 260
                 C 295 270 310 268 318 258 C 322 250 320 240 315 235
                 C 305 230 300 242 295 248 C 290 242 295 232 302 228
                 C 312 225 325 235 325 250 C 322 270 305 280 285 280
                 C 275 280 265 285 255 295 Z"
            />
            <path
              d="M 248 438 C 255 425 260 405 265 380 C 270 355 275 325 272 295
                 C 262 310 255 330 252 355 C 248 385 248 415 248 438 Z"
            />
          </g>

          {/* Deep Purple Solid Fill of Figures and Calligraphy */}
          <g fill="url(#calligGrad)">
            {/* Child 1 Head (Left figure) */}
            <circle cx="216" cy="142" r="20" />
            {/* Child 2 Head (Right figure - reaching higher) */}
            <circle cx="262" cy="122" r="22" />

            {/* Joyful arms reaching up */}
            <path d="M 205 168 C 188 152 182 132 192 126 C 202 120 210 136 216 154 Z" />
            <path d="M 272 146 C 288 130 298 110 308 116 C 316 122 302 142 285 158 Z" />

            {/* Upper calligraphy neck */}
            <path
              d="M 220 155 C 235 185 245 205 255 215 C 270 210 280 180 270 150
                 C 260 180 245 195 235 180 C 228 170 224 162 220 155 Z"
            />

            {/* Loop of 'ق' and curving spine of 'ا' */}
            <path
              d="M 215 180 C 180 190 165 220 170 250 C 175 275 195 290 225 295
                 C 200 310 180 335 185 365 C 190 395 220 425 248 438
                 C 240 405 235 370 235 340 C 235 315 245 300 255 295
                 C 265 290 270 275 270 255 C 270 230 255 210 240 200
                 C 230 220 205 235 195 250 C 190 260 195 270 205 270
                 C 220 270 235 255 240 235 C 242 225 230 205 215 180 Z"
            />

            {/* Flourish loop of 'ئم' */}
            <path
              d="M 255 295 C 275 290 305 295 320 280 C 335 265 335 240 325 220
                 C 315 205 295 205 285 218 C 275 230 275 248 285 260
                 C 295 270 310 268 318 258 C 322 250 320 240 315 235
                 C 305 230 300 242 295 248 C 290 242 295 232 302 228
                 C 312 225 325 235 325 250 C 322 270 305 280 285 280
                 C 275 280 265 285 255 295 Z"
            />

            {/* Lower stem resting gracefully onto the book */}
            <path
              d="M 248 438 C 255 425 260 405 265 380 C 270 355 275 325 272 295
                 C 262 310 255 330 252 355 C 248 385 248 415 248 438 Z"
            />
          </g>
        </g>
      </svg>
    </div>
  )
}
