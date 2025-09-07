
export { T as Temporal }
export let Intl, toTemporalInstant
let T
if (typeof Temporal === 'object' && Temporal != null) {
  T = Temporal
} else {
  ({ Temporal: T, Intl, toTemporalInstant } = require('temporal-polyfill'))
}
