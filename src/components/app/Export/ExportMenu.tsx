import { Download, FileCode2, MapPinned, Siren } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'

export function ExportMenu() {
  const t = useT()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm">
          <Download className="h-3.5 w-3.5" />
          {t('export.label')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[12px] font-medium text-muted-foreground">
          {t('export.heading')}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => alert('mock CAP-XML')}>
          <Siren className="h-4 w-4 text-destructive" />
          <div className="flex-1">
            <div className="text-sm">{t('export.cap')}</div>
            <div className="text-[12px] text-muted-foreground">{t('export.capSub')}</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => alert('mock GeoJSON')}>
          <FileCode2 className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <div className="text-sm">{t('export.geojson')}</div>
            <div className="text-[12px] text-muted-foreground">{t('export.geojsonSub')}</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => alert('mock HOT OSM')}>
          <MapPinned className="h-4 w-4 text-sar-amber" />
          <div className="flex-1">
            <div className="text-sm">{t('export.hot')}</div>
            <div className="text-[12px] text-muted-foreground">{t('export.hotSub')}</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[12px] text-muted-foreground font-normal leading-snug">
          {t('export.disclaimer')}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
