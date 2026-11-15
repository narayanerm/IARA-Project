import { cn } from '@/lib/utils'

export type CapyMood = 'idle' | 'thinking' | 'talking'

/**
 * The assistant's face: a small cartoon capybara drawn in the same flat style as the ask bar
 * leaves. She blinks on her own; `thinking` makes her look up and wiggle her ears, `talking`
 * moves her mouth. Purely decorative, so it is hidden from assistive tech.
 */
export function Capybara({ mood = 'idle', className }: { mood?: CapyMood; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('capy', `is-${mood}`, className)} aria-hidden="true" focusable="false">
      <path d="M5 64C5 51 16 45 32 45C48 45 59 51 59 64Z" fill="#a8734a" />
      <g className="capy-ear is-left">
        <ellipse cx="15" cy="14.5" rx="4.6" ry="5" fill="#8f5f3a" />
        <ellipse cx="15.4" cy="15.2" rx="2.2" ry="2.6" fill="#5f3d27" />
      </g>
      <g className="capy-ear is-right">
        <ellipse cx="49" cy="14.5" rx="4.6" ry="5" fill="#8f5f3a" />
        <ellipse cx="48.6" cy="15.2" rx="2.2" ry="2.6" fill="#5f3d27" />
      </g>
      <path d="M13 28C13 15 21 9 32 9C43 9 51 15 51 28V43C51 53 43.5 58 32 58C20.5 58 13 53 13 43Z" fill="#bd8757" />
      <path d="M13 28C13 15 21 9 32 9C43 9 51 15 51 28C45 20.5 39 18 32 18C25 18 19 20.5 13 28Z" fill="#a8734a" opacity="0.55" />
      <path d="M17.5 43.5C17.5 34.5 23 30 32 30C41 30 46.5 34.5 46.5 43.5C46.5 52 41 56 32 56C23 56 17.5 52 17.5 43.5Z" fill="#dcae7e" />
      <ellipse cx="16.5" cy="36" rx="3.2" ry="2.1" fill="hsl(var(--primary))" opacity="0.5" />
      <ellipse cx="47.5" cy="36" rx="3.2" ry="2.1" fill="hsl(var(--primary))" opacity="0.5" />
      <path d="M24 37C24 33.6 27 32.4 32 32.4C37 32.4 40 33.6 40 37C40 40.2 36.5 41.8 32 41.8C27.5 41.8 24 40.2 24 37Z" fill="#5a3a26" />
      <ellipse cx="28.3" cy="36.8" rx="1.2" ry="1.5" fill="#2e1c12" />
      <ellipse cx="35.7" cy="36.8" rx="1.2" ry="1.5" fill="#2e1c12" />
      <path className="capy-smile" d="M32 41.8V45.6M26.8 46.6C28.8 49 31 48.2 32 45.6C33 48.2 35.2 49 37.2 46.6" fill="none" stroke="#5a3a26" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse className="capy-mouth" cx="32" cy="48.6" rx="3" ry="2.6" fill="#5a2a22" />
      <g className="capy-eyes">
        <ellipse cx="20.5" cy="25" rx="2.7" ry="3.1" fill="#24160e" />
        <circle cx="21.4" cy="23.8" r="0.95" fill="#fff" />
        <ellipse cx="43.5" cy="25" rx="2.7" ry="3.1" fill="#24160e" />
        <circle cx="44.4" cy="23.8" r="0.95" fill="#fff" />
      </g>
      <g transform="translate(31 9.5) rotate(-38) scale(0.9)">
        <path d="M0 0C3.2-4.4 9.6-6.2 15.6-4.9C13.9 1.2 8.6 4.9 3.1 4.4C1.8 4.3.8 2.8 0 0Z" fill="#79c97a" />
        <path d="M0.6 0.2C5 -1 9.5 -2.2 14.4 -4.4" stroke="rgb(0 0 0 / 0.28)" strokeWidth="0.6" fill="none" />
      </g>
    </svg>
  )
}
