
import { test, expect, vi } from 'vitest'
import { defineRoute, resolveRoute } from './router'

test('router', () => {
  const routeMap = { __proto__: null }
  const handle = vi.fn(path => {
    return { type: path[0] }
  })
  defineRoute(routeMap, 'path/to', handle)
  expect(resolveRoute(routeMap, 'path/to/example')).toEqual({ type: 'example' })
  expect(handle).toHaveBeenCalledTimes(1)
  expect(handle).toHaveBeenCalledWith(['example'])
  expect(handle).toHaveReturnedWith({ type: 'example' })
})
