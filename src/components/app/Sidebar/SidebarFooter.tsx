export function SidebarFooter() {
  return (
    <div className="mt-auto pt-2 border-t border-border/40 text-[10px] font-mono text-muted-foreground leading-relaxed">
      TIs:{' '}
      <a
        href="https://terrabrasilis.dpi.inpe.br/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-foreground"
      >
        FUNAI via TerraBrasilis
      </a>
      . Ribeirinhas:{' '}
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
