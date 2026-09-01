
import { test, expect, vi } from 'vitest'
import { join } from '@/bind'
import { defineRoute, resolveRoute } from './router'

test('router', () => {
  const routeMap = { __proto__: null }
  const handle = vi.fn(path => ({ type: join(path, ',') }))
  defineRoute(routeMap, 'path/to', handle)

  expect(resolveRoute(routeMap, 'path/to/example')).toEqual({ type: 'example' })
  expect(resolveRoute(routeMap, 'path/no/example')).toBeUndefined()
  expect(handle).toHaveBeenCalledTimes(1)
  expect(handle).toHaveBeenCalledWith(['example'])
  expect(handle).toHaveReturnedWith({ type: 'example' })
})
