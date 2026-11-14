import { Scene3D } from './Scene3D'
import { Header } from './Header'
import { TextContent } from './TextContent'
import { ProgressBar } from './ProgressBar'
import { Credits } from './Credits'
import { ReleaseAnimation } from './ReleaseAnimation'
import { MosaicoEstatico } from './MosaicoEstatico'
import { useLandingPhase } from './hooks/useLandingPhase'
import './animations.css'

export function LoadingScreen({ onReady }: { onReady: () => void }) {
  const { webgl, reduz, pronto, progresso, fase, grade, botao, terminar, progredir, entrar } =
    useLandingPhase(onReady)

  return (
    <div
      className={`iara-capa ${pronto ? 'pronta' : ''} ${fase === 'revelando' ? 'saindo' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="iara-capa-titulo"
    >
      {fase !== 'revelando' && (
        <>
          <div className="iara-palco" aria-hidden="true">
            {webgl ? (
              <Scene3D aoTerminar={terminar} aoProgredir={progredir} reduz={reduz} />
            ) : (
              <MosaicoEstatico />
            )}
          </div>
          <div className="iara-veu" />

          <Header />

          <section className="iara-texto">
            <TextContent webgl={webgl} />
            <ProgressBar ref={botao} progresso={progresso} pronto={pronto} onEnter={entrar} />
            <Credits />
          </section>
        </>
      )}

      {fase !== 'capa' && (
        <ReleaseAnimation fase={fase} cols={grade.cols} rows={grade.rows} />
      )}
    </div>
  )
}
