import { useT } from '@/lib/i18n'

export function SidebarFooter() {
  const t = useT()
  return (
    <div className="mt-auto pt-2 border-t border-border/40 text-[10px] font-mono text-muted-foreground leading-relaxed">
      {t('sidebar.footer.lands')}:{' '}
      <a
        href="https://terrabrasilis.dpi.inpe.br/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-foreground"
      >
        {t('sidebar.footer.terraBrasilis')}
      </a>
      . {t('sidebar.footer.riversides')}:{' '}
      <a
        href="https://www.ibge.gov.br/geociencias/cartas-e-mapas/bases-cartograficas-continuas/15759-brasil.html"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-foreground"
      >
        IBGE BC250
      </a>
      .
    </div>
  )
}
