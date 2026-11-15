import { cn } from '@/lib/utils'

export type CapyMood = 'idle' | 'thinking' | 'talking'

const INK = '#4a2a30'

/**
 * The assistant's face: a small sticker-style capybara sitting and facing us, with a thick dark
 * outline, a big darker snout and smiling eyes. `thinking` opens her eyes, looking up, and
 * wiggles her ears; `talking` moves her mouth. Purely decorative, so it is hidden from
 * assistive tech.
 */
export function Capybara({ mood = 'idle', className }: { mood?: CapyMood; className?: string }) {
  return (
    <svg viewBox="-2 0 68 66" className={cn('capy', `is-${mood}`, className)} aria-hidden="true" focusable="false">
      <g stroke={INK} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
        <g className="capy-ear is-left">
          <circle cx="12.5" cy="10.5" r="5.2" fill="#c98f66" />
        </g>
        <g className="capy-ear is-right">
          <circle cx="51.5" cy="10.5" r="5.2" fill="#c98f66" />
        </g>
        <ellipse cx="11" cy="57" rx="7.5" ry="6" fill="#b98360" />
        <ellipse cx="53" cy="57" rx="7.5" ry="6" fill="#b98360" />
        <path d="M13 38C7 46 8 62 18 63.5H46C56 62 57 46 51 38Z" fill="#e0a877" />
        <path d="M24 63.5C23 55 27 50 32 50C37 50 41 55 40 63.5Z" fill="#fbe6c8" stroke="none" />
        <path d="M6 28C6 13 17 6 32 6C47 6 58 13 58 28C58 39 49 44 32 44C15 44 6 39 6 28Z" fill="#e8b182" />
      </g>
      <path d="M11.3 12.6C11.6 10.6 13 9.4 14.8 9.6" fill="none" stroke="#8f5f48" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M52.7 12.6C52.4 10.6 51 9.4 49.2 9.6" fill="none" stroke="#8f5f48" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 33C13 39.5 21 41.8 32 41.8C43 41.8 51 39.5 55.5 33C53 40 45 42.9 32 42.9C19 42.9 11 40 8.5 33Z" fill="#cf9367" />
      <path d="M22.5 26C22.5 19.5 26 17 32 17C38 17 41.5 19.5 41.5 26V31C41.5 37 38 39.5 32 39.5C26 39.5 22.5 37 22.5 31Z" fill="#ab7654" />
      <ellipse cx="28" cy="23" rx="1.7" ry="1.1" fill={INK} transform="rotate(20 28 23)" />
      <ellipse cx="36" cy="23" rx="1.7" ry="1.1" fill={INK} transform="rotate(-20 36 23)" />
      <ellipse className="capy-mouth" cx="32" cy="35" rx="3" ry="2.6" fill="#5a2a2c" />
      <path d="M32 26.5V33" fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" />
      <path className="capy-smile" d="M27.5 33C29.5 35.6 34.5 35.6 36.5 33" fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" />
      <path className="capy-eyes-happy" d="M12.5 21.5C14 18.8 18 18.8 19.5 21.5M44.5 21.5C46 18.8 50 18.8 51.5 21.5" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <g className="capy-eyes-open" fill={INK}>
        <circle cx="16" cy="19.8" r="2.3" />
        <circle cx="48" cy="19.8" r="2.3" />
        <circle cx="16.8" cy="18.9" r="0.8" fill="#fff" />
        <circle cx="48.8" cy="18.9" r="0.8" fill="#fff" />
      </g>
      <ellipse cx="13.5" cy="28" rx="4" ry="2.5" fill="#f4938a" opacity="0.85" />
      <ellipse cx="50.5" cy="28" rx="4" ry="2.5" fill="#f4938a" opacity="0.85" />
      <path d="M25 63V56M39 63V56" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M8 59.5V61.5M11 60.5V62.5M56 59.5V61.5M53 60.5V62.5" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
      <g transform="translate(31 6.5) rotate(-42) scale(0.8)">
        <path d="M0 0C3.2-4.4 9.6-6.2 15.6-4.9C13.9 1.2 8.6 4.9 3.1 4.4C1.8 4.3.8 2.8 0 0Z" fill="#79c97a" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
