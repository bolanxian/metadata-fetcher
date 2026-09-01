
import { test, expect, vi, beforeAll, afterEach } from 'vitest'
import { join } from '@/bind'
import { initFetch } from './fetch'
import { NoCache } from './cache'
import { defineDiscover } from './discover'
import { definePlugin, initCache, resolve, xparse, tryRedirect, redirectPlugin, parse } from './plugin'

let mockLocation = null
const mockFetch = vi.fn(async () => ({
  headers: { get: k => k === 'location' ? mockLocation : null }
}))

beforeAll(() => {
  initCache(new NoCache())
  initFetch(mockFetch, 'TestUA')
})
afterEach(() => {
  mockLocation = null
  mockFetch.mockClear()
})


defineDiscover({
  name: 'plain-source',
  discover: [/^plain:(\w+)$/],
  handle: m => `plain/${m[1]}`
})
defineDiscover({
  name: 'at-redir-source',
  discover: [/^atredir:(\w+)$/],
  handle: m => `atredir/${m[1]}`
})
defineDiscover({
  name: 'at-redir-target',
  discoverHttp: [/^target\.example\/(\w+)$/],
  handle: m => `target/${m[1]}`
})


// A plugin whose plain (no redirect)
definePlugin({
  name: 'Plain',
  path: 'plain',
  resolve(path) {
    if (path.length !== 1) { return }
    const id = `plain!${path[0]}`, displayId = `plain:${path[0]}`
    return {
      id, displayId, cacheId: id,
      shortUrl: '', url: `https://plain.example/${path[0]}`
    }
  },
  async fetch(cache, { id }) {
    return await cache.json(id, async () => ({ name: 'Title', tags: ['a', 'b'] }))
  },
  parse: {
    title: $ => $.name,
    keywords: $ => join($.tags, ',')
  }
})

// A plugin whose id starts with '@' (triggers tryRedirect)
definePlugin({
  name: 'AtPrefixed',
  path: 'atredir',
  resolve(path) {
    if (path.length !== 1) { return }
    const id = `@at!${path[0]}`
    return {
      id, displayId: id, cacheId: id,
      shortUrl: '', url: `https://at.example/${path[0]}`
    }
  },
  ...redirectPlugin
})

// A plugin reachable via http redirect target
definePlugin({
  name: 'Target',
  path: 'target',
  resolve(path) {
    if (path.length !== 1) { return }
    const id = `target!${path[0]}`
    return {
      id, displayId: id, cacheId: id,
      shortUrl: '', url: `https://target.example/${path[0]}`
    }
  },
  async fetch() { return {} },
  parse: () => ({ title: 'TargetTitle' })
})


test('resolve', () => {
  const info = resolve('plain:abc')
  expect(info).toEqual({
    id: 'plain!abc',
    displayId: 'plain:abc',
    cacheId: 'plain!abc',
    shortUrl: '',
    url: 'https://plain.example/abc'
  })
})

test('parse', async () => {
  const info = resolve('plain:abc')
  await expect(parse(info)).resolves.toMatchObject({
    ...info, title: 'Title', keywords: 'a,b'
  })
})

test('tryRedirect', async () => {
  //returns undefined when id does not start with "@"
  let info = resolve('plain:abc')
  expect(tryRedirect(info)).toBeUndefined()

  // resolves the redirect target when id starts with "@"
  mockLocation = 'https://target.example/bar'
  info = resolve('atredir:foo')
  expect(info.id).toBe('@at!foo')
  await expect(tryRedirect(info)).resolves.toMatchObject({ id: 'target!bar' })

  //returns null when redirect yields no location
  mockLocation = null
  info = resolve('atredir:foo')
  await expect(tryRedirect(info)).resolves.toBeNull()
})

test('xparse', async () => {
  const [plugin, resolved, redirectedPromise, dataPromise, parsedPromise, ...rest] = xparse('plain:abc')

  expect(plugin.name).toBe('Plain')
  expect(resolved.id).toBe('plain!abc')
  expect(redirectedPromise).toBeUndefined()
  expect(dataPromise).toBeInstanceOf(Promise)
  expect(parsedPromise).toBeInstanceOf(Promise)
  expect(rest).toEqual([])

  await expect(parsedPromise).resolves.toMatchObject({ title: 'Title', keywords: 'a,b' })
})

test('xparse (redirect)', async () => {
  mockLocation = 'https://target.example/bar'
  const [plugin, resolved, redirectedPromise, ...rest] = xparse('atredir:foo')

  expect(plugin.name).toBe('AtPrefixed')
  expect(resolved.id).toBe('@at!foo')
  expect(redirectedPromise).toBeInstanceOf(Promise)
  expect(rest).toEqual([])

  await expect(redirectedPromise).resolves.toMatchObject({
    id: 'target!bar',
    displayId: 'target!bar',
    cacheId: 'target!bar',
    shortUrl: '',
    url: 'https://target.example/bar',
  })
})