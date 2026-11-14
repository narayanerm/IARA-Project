import { TITULO } from './constants'

export function TextContent({ webgl }: { webgl: boolean }) {
  return (
    <div>
      <h1 id="iara-capa-titulo">
        {TITULO.map((p, i) => (
          <span key={i} className="iara-entra" style={{ ['--i' as string]: i }}>
            {p === 'radar' ? <em>{p}</em> : p}
            {i < TITULO.length - 1 ? ' ' : ''}
          </span>
        ))}
      </h1>
      <p className="iara-lead iara-entra" style={{ ['--i' as string]: 8 }}>
        A IARA é o painel da equipe sobre o radar NISAR em banda L, que atravessa nuvem, fumaça e
        copa de árvore. Garimpo, cheia e seca na Amazônia, com as Terras Indígenas em destaque.
      </p>
      {!webgl && (
        <p className="iara-aviso">
          Este navegador não liberou o WebGL2, então a cena e o mapa em 3D ficam desligados. Ative a
          aceleração de hardware nas configurações do navegador ou abra no Firefox.
        </p>
      )}
    </div>
  )
}
