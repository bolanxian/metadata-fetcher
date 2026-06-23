
import { createBinder } from 'bind:core'
import { getOwn, test, match, replace } from 'bind:utils'
import { slice, startsWith, endsWith } from 'bind:String'
import { freeze } from 'bind:Object'
import { join, resolveAsHttp } from '@/bind'
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
export let discoverGlobalRegExp: RegExp | undefined

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
  discoverGlobalRegExp = void 0
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
const getDiscoverGlobalRegExpInner = () => {
  const REG1 = /^\^|\$$/g, REG2 = /^\w+$/, REG3 = /(?<!(?<!\\)\\)\((?!\?)/g
  function* transform(map: Map<RegExp, any>) {
    for (let { source } of keys(map)) {
      source = replace(REG1, source, '')
      if (startsWith(source, '@') || test(REG2, source)) { continue }
      if (endsWith(source, '(?=$|[?#])')) {
        source = slice(source, 0, -10)
      }
      source = replace(REG3, source, '(?:')
      yield source
    }
  }
  const discoverHttpSource = join(transform(discoverHttpMap), '|')
  const discoverSource = join(transform(discoverMap), '|')
  return RegExp(`(?:(?:https?://)?(?:${discoverHttpSource}))|(?:${discoverSource})`, 'g')
}
export const getDiscoverGlobalRegExp = () => {
  return discoverGlobalRegExp ??= getDiscoverGlobalRegExpInner()
}
