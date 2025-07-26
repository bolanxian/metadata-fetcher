
import { $string, resolve, ready } from '../dist/main.ssr.js'
const { split } = $string
await ready

let test, eq
switch (`${typeof Deno}:${typeof Bun}`) {
  case 'object:undefined': {
    test = Deno.test
    eq = (await import('https://deno.land/std/assert/mod.ts')).assertEquals
  } break
  case 'undefined:object': {
    const TEST = await import('bun:test')
    test = TEST.test;
    eq = (a, b) => TEST.expect(a).toEqual(b)
  } break
}
{
  for (const line of [
    'av1 = BV1xx411c7mQ',
    'av2 = BV1xx411c7mD',
    'av3 = BV1xx411c7mS',

    'av137438953471 = BV16h4L1b7Bz',
    'av137438953472 = BV1FShH1w7Hk',
    'av2199023255551 = BV1QaMG1x7Uh',
    'av2199023255552 = BV1s24h2g7QT',
    'av70368744177663 = BV1rHNqoM7xg',
    'av70368744177664 = BV1RaJVEZEvi',

    'av1786632398213095 = BV1xxxxxxav1',
    'av2245227794580184 = BV1TypScript',
    'av2251799813685247 = BV1aPPTfmvQq',

    //from https://github.com/Colerar/abv/blob/main/tests/lib_test.rs
    'av11451419180 = BV1gA4v1m7BV',
    'av1145141919810 = BV1B8Ziyo7s2',
  ]) {
    const [a, b] = split(line, ' = ')
    test(`BV号: ${a} = ${b}`, () => {
      let $a = resolve(a), $b = resolve(b), id
      eq(a, $a.id)
      eq(a, $a.displayId)
      eq($a, $b)

      $a = resolve(`bv!${a}`), $b = resolve(id = `raw!${b}`)
      eq(id, $b.id)
      eq(b, $b.displayId)
      eq($a, $b)
    })
  }
}