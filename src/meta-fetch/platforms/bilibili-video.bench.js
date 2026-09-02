
import { describe, bench, vi, beforeAll, afterAll } from 'vitest'
import { resolve } from '../mod'
import { SortedMap } from '@/utils/sorted-map'

describe.each([
  ['without SortedMap', false],
  ['with SortedMap', true]
])('%s', (_, withSortedMap) => {
  if (!withSortedMap) {
    const addScore = vi.spyOn(SortedMap.prototype, 'addScore')
    beforeAll(() => {
      addScore.mockImplementation(() => { })
    })
    afterAll(() => {
      addScore.mockReset()
    })
  }
  bench('av号', () => {
    resolve('av1')
  })
  bench('BV号', () => {
    resolve('raw!BV1xx411c7mQ')
  })
  bench('av2bv', () => {
    resolve('bv!av1')
  })
  bench('bv2av', () => {
    resolve('BV1xx411c7mQ')
  })
})
