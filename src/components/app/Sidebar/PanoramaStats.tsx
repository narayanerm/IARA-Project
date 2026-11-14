import { MapPin, Pickaxe, Trees, Users, type LucideIcon } from 'lucide-react'

interface Panorama {
  localCount: number
  localArea: number
  population: number
  funaiCount: number | null
  funaiArea: number
  rivCount: number | null
  miningKm2: number
}

export function PanoramaStats({ panorama }: { panorama: Panorama }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <StatBox
        icon={Trees}
        value={`${panorama.funaiCount ?? panorama.localCount}`}
        label={panorama.funaiCount ? 'TIs FUNAI (Amz)' : 'TIs destacadas'}
      />
      <StatBox
        icon={Users}
        value={`${panorama.rivCount ?? '…'}`}
        label="Comunidades ribeirinhas"
      />
      <StatBox
        icon={MapPin}
        value={`${((panorama.funaiArea || panorama.localArea) / 1000).toFixed(0)}k`}
        label="km² TIs protegidos"
      />
      <StatBox
        icon={Pickaxe}
        value={`${panorama.miningKm2}`}
        label="km² garimpo em Yanomami"
      />
    </div>
  )
}

function StatBox({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon
  value: string
  label: string
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2">
      <div className="flex items-center gap-1 text-primary">
        <Icon className="h-3 w-3" strokeWidth={2} />
        <span className="text-base font-semibold leading-none">{value}</span>
      </div>
      <div className="text-[10px] font-mono text-muted-foreground mt-1 leading-tight">
        {label}
      </div>
    </div>
  )
}
