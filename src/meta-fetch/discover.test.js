
import { test, expect } from 'vitest'
import { defineDiscover, xresolveDiscover, resolveDiscover, getDiscoverGlobalRegExp, discoverMap } from './discover'


test('http-like', () => {
  defineDiscover({
    name: 'test-http',
    discoverHttp: [/^example\.com\/path\/(\w+)$/],
    handle: m => `http/${m[1]}`
  })
  for (const url of [
    'example.com/path/xyz',
    '//example.com/path/xyz',
    '://example.com/path/xyz',
    'http:example.com/path/xyz',
    'https:example.com/path/xyz',
    'http://example.com/path/xyz',
    'https://example.com/path/xyz',
  ]) {
    expect(resolveDiscover(url)).toBe('http/xyz')
  }
})

test('sort & lazy', () => {
  let calls = 0
  defineDiscover({
    name: 'test-lazy-a',
    discover: [/^lazy:(\w+)$|^lazy-a$/],
    handle: m => { calls++; return `lazy/a/${m[1]}` }
  })
  defineDiscover({
    name: 'test-lazy-b',
    discover: [/^lazy:(\w+)$|^lazy-b$/],
    handle: m => { calls++; return `lazy/b/${m[1]}` }
  })

  expect(resolveDiscover('lazy:foo')).toBe('lazy/a/foo')
  expect(calls).toBe(1)
  expect([...xresolveDiscover('lazy:foo')]).toEqual(['lazy/a/foo', 'lazy/b/foo'])
  expect(calls).toBe(3)
  for (const _ of [, ,]) {
    expect(resolveDiscover('lazy-b')).toBe('lazy/b/undefined')
  }
  expect([...xresolveDiscover('lazy:foo')]).toEqual(['lazy/b/foo', 'lazy/a/foo'])
  expect(calls).toBe(7)
})

test('GlobalRegExp', () => {
  // returns a RegExp and is cached
  const reg = getDiscoverGlobalRegExp()
  expect(reg).toBeInstanceOf(RegExp)
  expect(getDiscoverGlobalRegExp()).toBe(reg)

  // cache is invalidated after defineDiscover
  defineDiscover({
    name: 'test-invalidate',
    discover: [/^invalidate:(\w+)$/],
    handle: m => `inv/${m[1]}`
  })
  expect(getDiscoverGlobalRegExp()).not.toBe(reg)

  // matches a discoverable input
  expect(getDiscoverGlobalRegExp().test('globalmatch:abc')).toBe(false)
  defineDiscover({
    name: 'test-global-match',
    discover: [/^globalmatch:(\w+)$/],
    handle: m => `gm/${m[1]}`
  })
  expect(getDiscoverGlobalRegExp().test('globalmatch:abc')).toBe(true)
})
