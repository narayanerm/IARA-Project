import { cn } from '@/lib/utils'

export type CapyMood = 'idle' | 'thinking' | 'talking'

/**
 * The assistant's face: a small cartoon capybara in profile (long blunt snout, eye and ear set
 * high and far back), drawn in the same flat style as the ask bar leaves. She blinks on her own;
 * `thinking` makes her look up and wiggle her ear, `talking` moves her mouth. Purely decorative,
 * so it is hidden from assistive tech.
 */
export function Capybara({ mood = 'idle', className }: { mood?: CapyMood; className?: string }) {
  return (
    <svg viewBox="11 2 63 58" className={cn('capy', `is-${mood}`, className)} aria-hidden="true" focusable="false">
      <ellipse cx="33" cy="12.5" rx="3" ry="3.6" fill="#7a5032" />
      <path d="M8 60C4 44 10 30 26 27.5C38 26 46 30 50 38L53 60Z" fill="#a8734a" />
      <path d="M15 60C13 49 16 40 25 35.5" stroke="#8f5f3a" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.6" />
      <path d="M40 47C40 44 48 44 48 47V58.5C48 60 40 60 40 58.5Z" fill="#96643f" />
      <path d="M26 30C25 18 32 10.5 43 10.5L60 11.5C66.5 12 70.5 16 70.5 22V33C70.5 38.5 67 41.5 61.5 41.8L46 42.5C36 43 27 39 26 30Z" fill="#bd8757" />
      <path d="M26 30C25 18 32 10.5 43 10.5L60 11.5C66.5 12 70.5 16 70.5 22C64 18 56 16.5 46 17C37 17.5 29.5 22 26 30Z" fill="#a8734a" opacity="0.5" />
      <path d="M59 11.5L60 11.5C66.5 12 70.5 16 70.5 22V33C70.5 38.5 67 41.5 61.5 41.8L57 42C53 33 53.5 20 59 11.5Z" fill="#d3a273" />
      <path d="M62.5 11.8C67.5 12.6 70.5 16.2 70.5 21.5C66.5 21 63.3 17.5 62.5 11.8Z" fill="#5a3a26" />
      <ellipse cx="67.2" cy="17" rx="1.1" ry="1.6" fill="#2e1c12" transform="rotate(-25 67.2 17)" />
      <ellipse className="capy-mouth" cx="64.5" cy="35.4" rx="3.4" ry="2.4" fill="#5a2a22" />
      <path className="capy-smile" d="M70 32.5C66.5 35.8 62 35.8 58.5 33.8" fill="none" stroke="#5a3a26" strokeWidth="1.4" strokeLinecap="round" />
      <g fill="#5a3a26" opacity="0.55">
        <circle cx="62" cy="26" r="0.6" />
        <circle cx="64.8" cy="27.5" r="0.6" />
        <circle cx="62.3" cy="29.5" r="0.6" />
      </g>
      <ellipse cx="49.5" cy="32.5" rx="3.4" ry="2.3" fill="hsl(var(--primary))" opacity="0.5" />
      <g className="capy-eyes">
        <ellipse cx="46.5" cy="19.5" rx="2.2" ry="2.6" fill="#24160e" />
        <circle cx="47.3" cy="18.5" r="0.8" fill="#fff" />
      </g>
      <g className="capy-ear">
        <ellipse cx="37" cy="11.8" rx="3.8" ry="4.3" fill="#8f5f3a" />
        <ellipse cx="37.4" cy="12.4" rx="1.8" ry="2.2" fill="#5f3d27" />
      </g>
      <g transform="translate(44 10.5) rotate(-48) scale(0.8)">
        <path d="M0 0C3.2-4.4 9.6-6.2 15.6-4.9C13.9 1.2 8.6 4.9 3.1 4.4C1.8 4.3.8 2.8 0 0Z" fill="#79c97a" />
        <path d="M0.6 0.2C5 -1 9.5 -2.2 14.4 -4.4" stroke="rgb(0 0 0 / 0.28)" strokeWidth="0.6" fill="none" />
      </g>
    </svg>
  )
}
