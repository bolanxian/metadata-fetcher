
import { getOwn, test, match, replace } from 'bind:utils'
import { slice, endsWith } from 'bind:String'
import { freeze } from 'bind:Object'
import { join, resolveAsHttp } from '@/bind'
import { SortedMap } from '@/utils/sorted-map'

export type Discover = Readonly<{
  name: string
  discover?: readonly RegExp[]
  discoverHttp?: readonly RegExp[]
  handle: (m: RegExpMatchArray, reg: RegExp) => Iterable<string> | string | undefined
}>
export const discoverList: Discover[] = []
export const discoverMap: SortedMap<RegExp, Discover> = new SortedMap()
export const discoverHttpMap: SortedMap<RegExp, Discover> = new SortedMap()
export let discoverGlobalRegExp: RegExp | undefined

export function* xresolveDiscover(input: string) {
  if (!(input.length > 0)) { return }
  let map = discoverMap
  const maybeHttp = resolveAsHttp(input)
  if (maybeHttp != null) {
    map = discoverHttpMap
    input = maybeHttp
  }
  for (const reg of map.keys()) {
    const m = match(reg, input)
    if (m == null) { continue }
    const discover = map.get(reg)!.handle(m, reg)
    if (discover == null) { continue }
    map.addScore(reg, 1)
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
      discoverMap.set(reg, discover)
    }
  }
  if ((include = getOwn(discover, 'discoverHttp')) != null) {
    freeze(include)
    for (const reg of include) {
      discoverHttpMap.set(reg, discover)
    }
  }
  return discover
}
const getDiscoverGlobalRegExpInner = () => {
  const REG1 = /^\^|\$$/g
  const REG2 = /^@|^\(\?!noGlobal\)|^\w+$/
  const REG3 = /(?<!(?<!\\)\\)\((?!\?)/g
  function* transform(map: Map<RegExp, any>) {
    for (let { source } of map.keys()) {
      source = replace(REG1, source, '')
      if (test(REG2, source)) { continue }
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
