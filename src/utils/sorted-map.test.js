
import { test, expect, vi } from 'vitest'
import { SortedMap } from './sorted-map'

test('sorted map', () => {
  const map = new SortedMap()

  const entries = [
    ['a', 1], ['b', 2], ['c', 3], ['d', 4], ['e', 5]
  ]
  for (const entry of entries) {
    entry[0] = { name: entry[0] }
    map.set(entry[0], entry[1])
  }

  expect(map.size).toBe(5)

  map.addScore(entries[1][0], 1)
  map.addScore(entries[3][0], 1)
  map.addScore(entries[3][0], 1)

  const mapScore = k => [k.name, map.getScore(k)]
  expect([...map.keys()].map(mapScore)).toEqual([
    ['d', 2], ['b', 1], ['a', 0], ['c', 0], ['e', 0]
  ])

  map.delete(entries[4][0])

  expect(map.size).toBe(4)
})
