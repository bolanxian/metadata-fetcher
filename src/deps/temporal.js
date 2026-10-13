
import { $then } from 'bind:utils'
export { T as Temporal }; let T
export let Intl, toTemporalInstant
export let ready
if (typeof Temporal === 'object' && Temporal != null) {
  T = Temporal
} else {
  const TARGET = import.meta.env.TARGET
  const mod = TARGET == 'dsh' || TARGET == 'koishi'
    ? import('temporal-polyfill')
    : import('./dep-temporal')
  ready = $then(mod, $ => {
    void ({ Temporal: T, Intl, toTemporalInstant } = $)
    globalThis.TemporalPolyfill = T
  })
}
