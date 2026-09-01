
import { describe, test, expect, vi } from 'vitest'
import { NoCache, FsCache, WebCache } from './cache'


const createMockFs = () => {
  const files = new Map()
  return {
    async readFile(path) {
      if (files.has(path)) return files.get(path)
      const err = new Error('ENOENT')
      err.code = 'ENOENT'
      throw err
    },
    async writeFile(path, data) { files.set(path, data) }
  }
}
const createMockCache = () => {
  const store = new Map()
  return {
    async match(url) {
      const body = store.get(url)
      if (body != null) { return new Response(body) }
    },
    async put(url, resp) { store.set(url, await resp.text()) }
  }
}

test('NoCache', async () => {
  const cache = new NoCache()

  //.keys is empty
  expect([...cache.keys()]).toEqual([])

  //.get returns undefined
  expect(await cache.get('foo')).toBeUndefined()

  //.tryGet invokes fn and returns its result
  const tryGetFn = vi.fn(async () => 'value')
  expect(await cache.tryGet('foo', tryGetFn)).toBe('value')
  expect(await cache.get('foo')).toBeUndefined()
  expect(tryGetFn).toHaveBeenCalledTimes(1)

  //.set is a no-op (does not throw)
  await expect(cache.set('foo', 'bar')).resolves.toBeUndefined()

  //.json returns undefined when fn returns undefined
  await expect(cache.json('bar', async () => void 0)).resolves.toBeUndefined()
})

test('FsCache.keys', async () => {
  const cache = new FsCache(createMockFs(), '/cache')
  expect([...cache.keys()]).toEqual([])

  await cache.set('a/b.json', 'x')
  await cache.set('c.json', 'y')
  const keys = [...cache.keys()].sort()

  expect(keys).toEqual(['a!b', 'c'])
})

test('WebCache.keys', async () => {
  const cache = new WebCache(createMockCache())
  expect([...cache.keys()]).toEqual([])
})

describe.each([
  ['FsCache', () => new FsCache(createMockFs(), '/cache')],
  ['WebCache', () => new WebCache(createMockCache())]
])('%s', (name, createCache) => {
  test(name, async () => {
    const cache = createCache()

    //.get returns undefined for missing entry
    expect(await cache.get('missing')).toBeUndefined()

    //.set then get returns the value
    await cache.set('foo', 'bar')
    expect(await cache.get('foo')).toBe('bar')

    //.tryGet returns undefined when fn returns undefined
    expect(await cache.tryGet('empty', async () => void 0)).toBeUndefined()
    expect(await cache.get('empty')).toBeUndefined()

    //.tryGet calls fn on miss and store result
    const tryGetFn = vi.fn(async () => 'computed')
    expect(await cache.tryGet('item', tryGetFn)).toBe('computed')
    expect(await cache.tryGet('item', tryGetFn)).toBe('computed')
    expect(tryGetFn).toHaveBeenCalledTimes(1)
    // second call should hit cache, not fn
    const tryGetFn2 = vi.fn(async () => 'no-computed')
    expect(await cache.tryGet('item', tryGetFn2)).toBe('computed')
    expect(tryGetFn2).toHaveBeenCalledTimes(0)

    // resolves "/" in names to "!"
    await cache.set('a/b.json', 'data')
    expect(await cache.get('a!b.json')).toBe('data')
  })
  test(`${name}.json`, async () => {
    const cache = createCache()

    const jsonFn = vi.fn(async () => ({ a: 1 }))
    expect(await cache.json('bar', jsonFn)).toEqual({ a: 1 })
    expect(await cache.get('bar.json')).toBe('{"a":1}')
    expect(jsonFn).toHaveBeenCalledTimes(1)

    const jsonFn2 = vi.fn(async () => ({ a: 999 }))
    expect(await cache.json('bar', jsonFn2)).toEqual({ a: 1 })
    expect(jsonFn2).toHaveBeenCalledTimes(0)
  })
})

