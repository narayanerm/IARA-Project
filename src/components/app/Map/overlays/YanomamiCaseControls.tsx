import { Radar } from 'lucide-react'
import { useApp, useUi } from '@/lib/store'
import { cn } from '@/lib/utils'
import { CASES } from '@/data/cases'

/**
 * Floating SAR band selector shown in every case. Three bands (NISAR L, NISAR S,
 * Sentinel-1 C) with pre-built mosaics per case. In the YANO (garimpo) case we
 * also show the two ground-truth overlays that stack on any band: RADD alerts
 * and DETER mineração.
 * Positioned bottom-right, just above the HomeButton and the MapLibre attribution.
 */

type Band = 'nisar' | 'sband' | 's1c'

const BANDS: Array<{ id: Band; label: string; sub: string; color: string }> = [
  { id: 'nisar', label: 'NISAR L-band', sub: 'λ 24 cm · penetra copa', color: '#F07A45' },
  { id: 'sband', label: 'NISAR S-band', sub: 'λ 10 cm · topo do dossel', color: '#B59EF5' },
  { id: 's1c', label: 'Sentinel-1 C', sub: 'λ 5,6 cm · superfície', color: '#9ED9FF' },
]

export function YanomamiCaseControls() {
  const activeRegion = useApp((s) => s.activeRegion)
  const aoiActive = useApp((s) => s.aoiActive)
  const band = useUi((s) => s.yanomamiBand)
  const raddOn = useUi((s) => s.yanomamiRaddOn)
  const deterOn = useUi((s) => s.yanomamiDeterOn)
  const setBand = useUi((s) => s.setYanomamiBand)
  const toggleRadd = useUi((s) => s.toggleYanomamiRadd)
  const toggleDeter = useUi((s) => s.toggleYanomamiDeter)

  if (!aoiActive) return null

  const caseName = CASES[activeRegion].placeShort
  const showGarimpoOverlays = activeRegion === 'YANO'

  return (
    <div
      className="pointer-events-auto absolute z-30 flex flex-col gap-1.5 rounded-lg border border-border/60 bg-background/90 p-2.5 backdrop-blur-sm shadow-lg"
      style={{ right: 8, bottom: 44, width: 232 }}
    >
      <div className="flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
        <Radar className="h-3 w-3" style={{ color: '#F07A45' }} />
        {caseName} · banda SAR
      </div>

      {BANDS.map((b) => {
        const active = band === b.id
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => setBand(active ? null : b.id)}
            className={cn(
              'flex items-start gap-2 rounded-md border px-2 py-1.5 text-left text-[11.5px] transition-colors',
              active
                ? 'bg-background text-foreground'
                : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
            )}
            style={active ? { borderColor: b.color, background: `${b.color}20` } : undefined}
          >
            <span
              className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                background: active ? b.color : 'transparent',
                boxShadow: `inset 0 0 0 1px ${b.color}`,
              }}
            />
            <span className="flex flex-col gap-0 leading-tight">
              <span className="font-semibold">{b.label}</span>
              <span className="text-[9.5px] text-muted-foreground">{b.sub}</span>
            </span>
          </button>
        )
      })}

      {showGarimpoOverlays && (
        <div className="border-t border-border/60 pt-1.5 mt-0.5 flex flex-col gap-1.5">
          <div className="text-[10.5px] font-mono uppercase tracking-wider text-muted-foreground">
            Sobreposições
          </div>
          <button
            type="button"
            onClick={toggleRadd}
            className={cn(
              'flex items-start gap-2 rounded-md border px-2 py-1.5 text-left text-[11.5px] transition-colors w-full',
              raddOn
                ? 'bg-background text-foreground'
                : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
            )}
            style={raddOn ? { borderColor: '#FF4D6D', background: '#FF4D6D20' } : undefined}
          >
            <span
              className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{
                background: raddOn ? '#FF4D6D' : 'transparent',
                boxShadow: 'inset 0 0 0 1px #FF4D6D',
              }}
            />
            <span className="flex flex-col gap-0 leading-tight">
              <span className="font-semibold">RADD alertas</span>
              <span className="text-[9.5px] text-muted-foreground">S1-derivado · 2020→hoje</span>
            </span>
          </button>
          <button
            type="button"
            onClick={toggleDeter}
            className={cn(
              'flex items-start gap-2 rounded-md border px-2 py-1.5 text-left text-[11.5px] transition-colors w-full',
              deterOn
                ? 'border-white/80 bg-white/10 text-foreground'
                : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
            )}
          >
            <span
              className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: deterOn ? '#ffffff' : 'transparent', boxShadow: 'inset 0 0 0 1px #ffffff' }}
            />
            <span className="flex flex-col gap-0 leading-tight">
              <span className="font-semibold">DETER mineração</span>
              <span className="text-[9.5px] text-muted-foreground">683 polígonos INPE · 2019-2026</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
