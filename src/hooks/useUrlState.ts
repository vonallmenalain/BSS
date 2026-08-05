import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Eine Einstellung der Ansicht, die in der Adresse steht.
 *
 * Welcher Reiter offen ist, wonach gefiltert wird, was in der Suche steht –
 * das gehört in die Adresse und nicht in einen Zustand, den ein
 * Seitenwechsel wegwirft. Erst dadurch führt «Zurück» wirklich dorthin
 * zurück, wo man war: Der Browser bringt die Adresse mit, die Adresse bringt
 * die Ansicht mit (siehe `hooks/useBack`).
 *
 * Der Vorgabewert steht nicht in der Adresse – so bleibt sie sauber, solange
 * nichts umgestellt wurde.
 *
 * Geschrieben wird mit `replace`: Das Umschalten eines Reiters ist kein
 * Schritt, den man mit der Zurück-Geste einzeln zurücknehmen möchte. Sonst
 * müsste man sich durch jede Zwischeneinstellung zurücktippen, bevor man die
 * Seite verlässt.
 */
export function useUrlState<T extends string>(
  param: string,
  fallback: T,
  allowed?: readonly T[],
): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams()

  const raw = params.get(param)
  const value = raw !== null && (!allowed || allowed.includes(raw as T)) ? (raw as T) : fallback

  const set = useCallback(
    (next: T) => {
      setParams(
        (current) => {
          const merged = new URLSearchParams(current)
          if (next === fallback || next === '') merged.delete(param)
          else merged.set(param, next)
          return merged
        },
        { replace: true },
      )
    },
    [setParams, param, fallback],
  )

  return [value, set]
}
