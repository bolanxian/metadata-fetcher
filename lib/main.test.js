
import { assertEquals as eq } from 'https://deno.land/std/assert/mod.ts'

globalThis.process ??= {}
globalThis.process.env ??= {}
globalThis.document ??= { addEventListener() { }, createElement() { } }

const { $string, resolve, ready } = await import('../dist/main.ssr.js')
await ready

const { split } = $string
Deno.test('BV号', async (t) => {
  for (const line of [
    'av1 = BV1xx411c7mQ',
    'av2 = BV1xx411c7mD',
    'av3 = BV1xx411c7mS',
    'av1786632398213095 = BV1xxxxxxav1',
    'av2245227794580184 = BV1TypScript',
    'av2251799813685247 = BV1aPPTfmvQq',

    //from https://github.com/Colerar/abv/blob/main/tests/lib_test.rs
    'av11451419180 = BV1gA4v1m7BV',
    'av1145141919810 = BV1B8Ziyo7s2',
  ]) {
    const [a, b] = split(line, ' = ')
    await t.step(`${a} = ${b}`, () => {
      let $a = resolve(a), $b = resolve(b), id
      eq(a, $a.id)
      eq(a, $a.rawId)
      eq($a, $b)

      $a = resolve(`bv!${a}`), $b = resolve(id = `raw!${b}`)
      eq(id, $b.id)
      eq(b, $b.rawId)
      eq($a, $b)
    })
  }
})