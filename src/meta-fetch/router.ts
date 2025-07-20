import { getOwn } from 'bind:utils'
import { split } from 'bind:String'
import { isArray, slice } from 'bind:Array'
const deu = decodeURIComponent

export interface RouteMap<R extends {}> extends Record<string, RouteMap<R> | ((path: string[]) => R | undefined) | undefined> { }
export const resolveRoute = <R extends {}>(
  routeMap: RouteMap<R>, path: string | string[]
): R | undefined => {
  path = isArray(path) ? path : split(path, '/')
  let i = 0; for (; i < path.length; i++) {
    const elem = deu(path[i])
    const next = getOwn(routeMap, elem)
    switch (typeof next) {
      case 'object': routeMap = next; break
      case 'function': return next(slice(path, i + 1))
      default: return
    }
  }
}
export const defineRoute = <R extends {}>(
  routeMap: RouteMap<R>, path: string | string[], fn: (path: string[]) => R | undefined
) => {
  path = isArray(path) ? path : split(path, '/')
  let i = 0, len = path.length - 1; for (; i < len; i++) {
    const elem = deu(path[i])
    const next = routeMap[elem] ??= {}
    if (typeof next !== 'object') { return }
    routeMap = next
  }
  routeMap[path[len]] = fn
}