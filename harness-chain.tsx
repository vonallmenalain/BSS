import { createRoot } from 'react-dom/client'
import '@/index.css'
import { ImpulseGameStage } from '@/components/impulse/game/ImpulseGameStage'

/* Nur zum Prüfen mit Playwright – wird danach gelöscht. */
if (new URLSearchParams(location.search).has('dark')) document.documentElement.classList.add('dark')
createRoot(document.getElementById('root')!).render(
  <ImpulseGameStage
    game="befreien"
    title="Ketten sprengen"
    onClose={() => {}}
    onRoundEnd={() => ({ previousBest: null })}
    renderResult={({ points }) => <p className="text-2xl font-bold">{points} Punkte</p>}
  />,
)
