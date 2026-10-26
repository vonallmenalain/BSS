import type { ComponentType } from 'react'
import type { ImpulseGameId } from '@/lib/types'
import type {
  GameEngine,
  GameEngineEvents,
  GameEngineOptions,
} from '@/components/impulse/game/canvasKit'
import { attachChainControls, ChainGame } from '@/components/impulse/game/chainGame'
import {
  ChainIntro,
  RunIntro,
  ShieldIntro,
  SortIntro,
  StackIntro,
} from '@/components/impulse/game/ImpulseGameIntros'
import { attachRunControls, RunGame } from '@/components/impulse/game/runGame'
import { attachShieldControls, ShieldGame } from '@/components/impulse/game/shieldGame'
import { attachSortControls, SortGame } from '@/components/impulse/game/sortGame'
import { attachStackControls, StackGame } from '@/components/impulse/game/stackGame'

/*
 * Welches Spiel zu welchem Schlüssel gehört – die eine Stelle, an der die
 * Bühne (`ImpulseGameStage`) nachschlägt. Karte, Rangliste und Speichern
 * wissen nichts vom einzelnen Spiel; sie kennen nur den Schlüssel
 * (`ImpulseGameId`) und die Punkte.
 *
 * Jedes Spiel bringt zweierlei: wie es auf die Leinwand kommt samt seiner
 * Steuerung (`mount`) und die Erklärung vor der ersten Runde (`Intro`).
 * Die Steuerung meldet sich nur, solange gespielt wird (`active`) – in
 * der Pause oder auf der Ergebnistafel greift kein Tipp ins Spiel.
 */

export interface GameDefinition {
  mount(
    surface: HTMLElement,
    options: GameEngineOptions,
    events: GameEngineEvents,
    active: () => boolean,
  ): { engine: GameEngine; detach: () => void }
  Intro: ComponentType
}

export const IMPULSE_GAMES: Record<ImpulseGameId, GameDefinition> = {
  sortieren: {
    mount(surface, options, events, active) {
      const engine = new SortGame(options, events)
      const detach = attachSortControls(surface, (side) => {
        if (active()) engine.input(side)
      })
      return { engine, detach }
    },
    Intro: SortIntro,
  },
  abwehren: {
    mount(surface, options, events, active) {
      const engine = new ShieldGame(options, events)
      const detach = attachShieldControls(surface, {
        point: (x, y) => {
          if (active()) engine.pointAt(x, y)
        },
        dir: (dir) => {
          if (active()) engine.turn(dir)
        },
      })
      return { engine, detach }
    },
    Intro: ShieldIntro,
  },
  springen: {
    mount(surface, options, events, active) {
      const engine = new RunGame(options, events)
      const detach = attachRunControls(surface, {
        press: () => {
          if (active()) engine.press()
        },
        // Loslassen immer: Ein Finger, der in der Pause liegen blieb, soll danach nicht weiter «halten».
        release: () => engine.release(),
      })
      return { engine, detach }
    },
    Intro: RunIntro,
  },
  befreien: {
    mount(surface, options, events, active) {
      const engine = new ChainGame(options, events)
      const detach = attachChainControls(surface, {
        point: (x, y) => {
          if (active()) engine.tapAt(x, y)
        },
        slot: (slot) => {
          if (active()) engine.tapSlot(slot, true)
        },
      })
      return { engine, detach }
    },
    Intro: ChainIntro,
  },
  stapeln: {
    mount(surface, options, events, active) {
      const engine = new StackGame(options, events)
      const detach = attachStackControls(surface, () => {
        if (active()) engine.press()
      })
      return { engine, detach }
    },
    Intro: StackIntro,
  },
}
