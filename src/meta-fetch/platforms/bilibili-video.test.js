
import { test, expect } from 'vitest'
import { resolve } from '../mod'
const eq = (a, b) => expect(a).toEqual(b)

for (const [av, bv] of [
  ['av1', 'BV1xx411c7mQ'],
  ['av2', 'BV1xx411c7mD'],
  ['av3', 'BV1xx411c7mS'],

  ['av137438953471', 'BV16h4L1b7Bz'],
  ['av137438953472', 'BV1FShH1w7Hk'],
  ['av2199023255551', 'BV1QaMG1x7Uh'],
  ['av2199023255552', 'BV1s24h2g7QT'],
  ['av70368744177663', 'BV1rHNqoM7xg'],
  ['av70368744177664', 'BV1RaJVEZEvi'],

  ['av1786632398213095', 'BV1xxxxxxav1'],
  ['av2245227794580184', 'BV1TypScript'],
  ['av2251799813685247', 'BV1aPPTfmvQq'],

  //from https://github.com/Colerar/abv/blob/main/tests/lib_test.rs
  ['av11451419180', 'BV1gA4v1m7BV'],
  ['av1145141919810', 'BV1B8Ziyo7s2'],
]) {
  test(`av: ${av} = ${bv}`, () => {
    const $a = resolve(av), $b = resolve(bv)
    eq(av, $a.id)
    eq(av, $a.displayId)
    eq(av, $a.cacheId)
    eq($a, $b)
  })
  test(`BV: ${bv} = ${av}`, () => {
    const id = `raw!${bv}`
    const $a = resolve(`bv!${av}`), $b = resolve(id)
    eq(id, $b.id)
    eq(bv, $b.displayId)
    eq(bv, $b.cacheId)
    eq($a, $b)
  })
}

test('undefined av', () => {
  const av = 'av2251799813685248'
  eq(resolve(`bv!${av}`).id, av)
})
test('undefined BV', () => {
  const bv = 'BV1TypeScrpt'
  eq(resolve(bv).id, `raw!${bv}`)
})
