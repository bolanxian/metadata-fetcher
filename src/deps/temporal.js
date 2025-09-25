
import { $then } from 'bind:utils'
export { T as Temporal }; let T
export let Intl, toTemporalInstant
export let ready
if (typeof Temporal === 'object' && Temporal != null) {
  T = Temporal
} else if (import.meta.env.TARGET == 'koishi') {
  void ({ Temporal: T, Intl, toTemporalInstant } = require('temporal-polyfill'))
} else {
  ready = $then(import('./dep-temporal'), $ => {
    void ({ Temporal: T, Intl, toTemporalInstant } = $)
    globalThis.TemporalPolyfill = T
  })
}
