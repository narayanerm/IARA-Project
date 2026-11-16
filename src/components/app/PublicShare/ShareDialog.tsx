import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, Link as LinkIcon, Mail, Share2, X } from 'lucide-react'
import { CASES } from '@/data/cases'
import { useApp } from '@/lib/store'
import { screenLink, screenState, type SarBand } from '@/lib/url-state'
import { useT, type TKey } from '@/lib/i18n'
import { useTr } from '../Cases/shared'

// Brand marks drawn inline (the icon set has no brand logos).
const WhatsApp = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
  </svg>
)
const XMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
  </svg>
)
const LinkedIn = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2ZM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2ZM7.1 20.5H3.5V9h3.6v11.5Z" />
  </svg>
)

const TAB_KEY: Record<string, TKey> = {
  overview: 'case.tab.overview',
  timeline: 'case.tab.timeline',
  alerts: 'case.tab.alerts',
}
const BAND_LABEL: Record<SarBand, string> = { nisar: 'NISAR L-band', sband: 'NISAR S-band', s1c: 'Sentinel-1' }
const PANEL_KEY: Record<string, TKey> = { nisar: 'rp.nisar', meta: 'rp.meta', chat: 'rp.chat' }

export function ShareDialog() {
  const t = useT()
  const tr = useTr()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const activeRegion = useApp((s) => s.activeRegion)
  const c = CASES[activeRegion]

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(id)
  }, [copied])

  // The screen cannot change while the dialog covers it, so the snapshot is taken on open.
  const snap = useMemo(() => {
    if (!open) return null
    return { s: screenState(), link: screenLink() }
  }, [open])

  if (!snap) {
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Trigger label={t('share.trigger')} aria={t('share.aria.openShare')} />
      </Dialog.Root>
    )
  }

  const { s, link } = snap
  const inCase = !!s.aoi
  const color = inCase ? c.color : '#5AA7C9'
  const year = s.tab === 'timeline' && s.year ? s.year : null
  const message = inCase
    ? t('share.message', { headline: tr(c.headline), place: tr(c.place), year: year ? ` (${year})` : '' })
    : t('share.messageHome')

  // What travels with the link, in reading order.
  const zone = s.zone ? c.hotspots.find((h) => h.id === s.zone) : undefined
  const chips: Array<{ k: string; label: string; value?: string }> = inCase
    ? [
        { k: 'case', label: t('share.chip.case'), value: c.placeShort },
        { k: 'tab', label: t('share.chip.tab'), value: t(TAB_KEY[s.tab ?? 'overview']) },
        ...(s.year ? [{ k: 'year', label: t('share.chip.year'), value: String(s.year) }] : []),
        ...(zone ? [{ k: 'zone', label: t('share.chip.zone'), value: zone.name }] : []),
        {
          k: 'base',
          label: t('share.chip.base'),
          value: [s.satellite === false ? t('share.base.dark') : t('share.base.satellite'), s.relief && t('share.chip.relief')]
            .filter(Boolean)
            .join(' + '),
        },
        ...(s.band ? [{ k: 'band', label: t('share.chip.band'), value: BAND_LABEL[s.band] }] : []),
        ...(s.radd ? [{ k: 'radd', label: t('share.chip.radd') }] : []),
        ...(s.deter ? [{ k: 'deter', label: t('share.chip.deter') }] : []),
        ...(s.radar === false ? [{ k: 'radar', label: t('share.chip.radarOff') }] : []),
        ...(s.nasa ? [{ k: 'nasa', label: t('share.chip.nasa') }] : []),
        ...(s.trueColor ? [{ k: 'tc', label: t('share.chip.trueColor') }] : []),
        ...(s.layer ? [{ k: 'layer', label: t('share.chip.product'), value: s.layer }] : []),
        ...(s.sar ? [{ k: 'sar', label: t('share.chip.sar') }] : []),
        ...(s.panel ? [{ k: 'panel', label: t('share.chip.panel'), value: t(PANEL_KEY[s.panel]) }] : []),
        { k: 'lang', label: t('share.chip.lang'), value: s.lang === 'en' ? 'English' : 'Português' },
      ]
    : []

  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const enc = encodeURIComponent
  const targets = [
    { id: 'whatsapp', label: 'WhatsApp', icon: <WhatsApp />, href: `https://wa.me/?text=${enc(`${message}\n${link}`)}` },
    { id: 'x', label: 'X', icon: <XMark />, href: `https://twitter.com/intent/tweet?text=${enc(message)}&url=${enc(link)}` },
    { id: 'linkedin', label: 'LinkedIn', icon: <LinkedIn />, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(link)}` },
    {
      id: 'email',
      label: t('share.email'),
      icon: <Mail className="h-4 w-4" />,
      href: `mailto:?subject=${enc(`IARA · ${inCase ? tr(c.place) : 'NASA Space Apps 2026'}`)}&body=${enc(`${message}\n\n${link}`)}`,
    },
  ]

  const copy = () => {
    navigator.clipboard
      .writeText(link)
      .then(() => setCopied(true))
      .catch(() => {})
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Trigger label={t('share.trigger')} aria={t('share.aria.openShare')} />

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[9999] max-h-[90vh] w-[min(500px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-white/10 bg-background/90 shadow-2xl backdrop-blur-2xl backdrop-saturate-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          style={{ '--case': color } as CSSProperties}
        >
          {/* Header: which screen is being shared, in the case's own colour. */}
          <div className="relative px-6 pb-5 pt-6">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              {t('share.kicker')}
            </div>
            <Dialog.Title className="mt-2 pr-8 text-[1.7rem] font-light leading-[1.05] tracking-[-0.03em] text-foreground">
              {inCase ? tr(c.place) : 'IARA'}
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
              {t('share.description')}
            </Dialog.Description>
            <Dialog.Close asChild>
              <button
                className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                aria-label={t('share.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-6 px-6 pb-6">
            {inCase && (
              <section className="space-y-3">
                <Label>{t('share.included')}</Label>
                <ul className="flex flex-wrap gap-1.5">
                  {chips.map((x) => (
                    <li
                      key={x.k}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] leading-none"
                    >
                      <span className="h-1 w-1 rounded-full" style={{ background: color }} />
                      <span className={x.value ? 'text-muted-foreground' : 'text-foreground/90'}>{x.label}</span>
                      {x.value && <span className="font-medium text-foreground/90">{x.value}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-3">
              <Label>{t('share.preview')}</Label>
              <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                <div className="h-1" style={{ background: color }} />
                <div className="space-y-1.5 p-3.5">
                  <p className="text-[13.5px] leading-snug text-foreground/90">{message}</p>
                  <p className="truncate font-mono text-[11.5px] text-muted-foreground">{link.replace(/^https?:\/\//, '')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md text-[13px] font-bold text-background transition-transform active:scale-[0.98]"
                  style={{ background: color }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                  {copied ? t('share.copied') : t('share.copyLink')}
                </button>
                {canNative && (
                  <button
                    type="button"
                    onClick={() => navigator.share({ title: 'IARA', text: message, url: link }).catch(() => {})}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/15 px-3.5 text-[13px] font-bold text-foreground transition-colors hover:bg-white/5"
                  >
                    <Share2 className="h-4 w-4" />
                    {t('share.more')}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {targets.map((x) => (
                  <a
                    key={x.id}
                    href={x.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center gap-1.5 rounded-lg border border-white/10 py-2.5 text-muted-foreground transition-colors hover:border-[color:var(--case)] hover:text-foreground"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/5 transition-colors group-hover:bg-[color:var(--case)] group-hover:text-background">
                      {x.icon}
                    </span>
                    <span className="text-[11.5px] font-medium">{x.label}</span>
                  </a>
                ))}
              </div>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Trigger({ label, aria }: { label: string; aria: string }) {
  return (
    <Dialog.Trigger asChild>
      <button
        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3 font-sans text-[13px] font-bold tracking-[-0.005em] text-foreground/75 transition-colors hover:bg-black/55 hover:text-foreground hover:backdrop-blur-xl hover:backdrop-saturate-150 active:scale-[0.97]"
        aria-label={aria}
      >
        <Share2 className="h-3.5 w-3.5" strokeWidth={2.25} />
        <span>{label}</span>
      </button>
    </Dialog.Trigger>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <h3 className="font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">{children}</h3>
}
