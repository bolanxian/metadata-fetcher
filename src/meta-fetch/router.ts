import { getOwn } from 'bind:utils'
import { split } from 'bind:String'
import { isArray, slice } from 'bind:Array'
const deu = decodeURIComponent

const Handle = Symbol('route-handle')
type Handle<R> = (path: string[]) => R | undefined
export interface RouteMap<R> {
  [K: string]: RouteMap<R> | undefined
  [Handle]?: Handle<R>
}
export const resolveRoute = <R>(
  routeMap: RouteMap<R>, path: string | string[]
): R | undefined => {
  path = isArray(path) ? path : split(path, '/')
  let i = 0; for (; i < path.length; i++) {
    const elem = deu(path[i]!)
    const next = getOwn(routeMap, elem)
    if (next == null) {
      return routeMap[Handle]?.(slice(path, i))
    }
    routeMap = next
  }
}
export const defineRoute = <R>(
  routeMap: RouteMap<R>, path: string | string[], handle: Handle<R>
) => {
  path = isArray(path) ? path : split(path, '/')
  let i = 0; for (; i < path.length; i++) {
    const elem = deu(path[i]!)
    const next = routeMap[elem] ??= { __proto__: null! }
    routeMap = next
  }
  routeMap[Handle] = handle
}