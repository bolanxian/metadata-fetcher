
import { createBinder } from 'bind:core'
import { getOwn, match } from 'bind:utils'
import { freeze } from 'bind:Object'
import { resolveAsHttp } from '@/bind'
const { get, set, keys } = createBinder<Map<RegExp, Discover>>(Map.prototype)

export type Discover = Readonly<{
  name: string
  discover?: readonly RegExp[]
  discoverHttp?: readonly RegExp[]
  handle: (m: RegExpMatchArray, reg: RegExp) => Iterable<string> | string | undefined
}>
export const discoverList: Discover[] = []
export const discoverMap: Map<RegExp, Discover> = new Map()
export const discoverHttpMap: Map<RegExp, Discover> = new Map()

export function* xresolveDiscover(input: string) {
  if (!(input.length > 0)) { return }
  let map = discoverMap
  const maybeHttp = resolveAsHttp(input)
  if (maybeHttp != null) {
    map = discoverHttpMap
    input = maybeHttp
  }
  for (const reg of keys(map)) {
    const m = match(reg, input)
    if (m == null) { continue }
    const discover = get(map, reg)!.handle(m, reg)
    if (discover == null) { continue }
    if (typeof discover === 'string') { yield discover }
    else { yield* discover }
  }
}
export const resolveDiscover = (input: string) => {
  for (const discover of xresolveDiscover(input)) {
    return discover
  }
}
export const defineDiscover = (discover: Discover) => {
  freeze(discover)
  discoverList[discoverList.length] = discover
  let include: readonly RegExp[] | undefined
  if ((include = getOwn(discover, 'discover')) != null) {
    freeze(include)
    for (const reg of include) {
      set(discoverMap, reg, discover)
    }
  }
  if ((include = getOwn(discover, 'discoverHttp')) != null) {
    freeze(include)
    for (const reg of include) {
      set(discoverHttpMap, reg, discover)
    }
  }
  return discover
}
