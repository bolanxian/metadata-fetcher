
import type { DefineComponent, ExtractPropTypes, Prop } from 'vue'
import { noop, voidPromise } from '@/bind'
import { call } from 'bind:core'
import { type Override, assert, $then } from 'bind:utils'
import { freeze, keys, fromEntries } from 'bind:Object'
import { from, filter } from 'bind:Array'
import { get, set } from 'bind:WeakMap'
import type { BaseCache } from './cache'
import { redirect } from './fetch'
import { xresolveDiscover } from './discover'
import { type RouteMap, defineRoute, resolveRoute } from './router'

export let cache: BaseCache = null!
export let initCache = ($cache: BaseCache) => {
  initCache = null!
  cache = $cache
}

export interface Plugin<T extends {} = {}> {
  name: string
  path: string
  resolve(path: string[]): ResolvedInfo | undefined
  fetch(cache: BaseCache, info: ResolvedInfo): Promise<T | undefined>
  parse(data: T, info: ResolvedInfo): ParsedInfo | undefined
}
export type DefinePlugin<T extends {}> = Override<Plugin<T>, {
  parse: Plugin<T>['parse'] | {
    [K in keyof ParsedInfo]: (data: T, info: ResolvedInfo) => ParsedInfo[K] | undefined
  }
}>
export type Component<T> = DefineComponent<ExtractPropTypes<{ data: Prop<T> }>, {}, any>
export interface ResolvedInfo {
  id: string
  displayId: string
  cacheId: string
  shortUrl: string
  url: string
}
export interface ParsedInfo {
  title: string
  ownerName?: string
  ownerUrl?: string
  thumbnailUrl?: string
  relatedUrl?: string
  publishDate?: string
  keywords?: string
  description?: string
}
export const resolvedToPlugin: WeakMap<ResolvedInfo, Plugin> = new WeakMap()
export const pluginToComponent: WeakMap<Plugin, Component<{}>> = new WeakMap()
export const pluginList: Plugin[] = []
export const routeMap: RouteMap<ResolvedInfo> = {}

export function* xresolve(input: string): Generator<ResolvedInfo> {
  for (const discover of xresolveDiscover(input)) {
    const route = resolveRoute(routeMap, discover)
    if (route != null) { yield route }
  }
}
export const resolve = (input: string): ResolvedInfo | null => {
  for (const route of xresolve(input)) { return route }
  return null
}
export const tryRedirectInner = async (info: ResolvedInfo): Promise<ResolvedInfo | null> => {
  const url = await redirect(info.url)
  if (url == null) { return null }
  const resolved = resolve(new URL(url, info.url).href)
  return resolved
}
export const tryRedirect = (info: ResolvedInfo): Promise<ResolvedInfo | null> | undefined => {
  if (info.id[0] === '@') { return tryRedirectInner(info) }
}
export const parse = async (info: ResolvedInfo): Promise<ResolvedInfo & ParsedInfo | null> => {
  const plugin: Plugin = get(resolvedToPlugin, info)
  const data = await plugin.fetch(cache, info)
  if (data == null) { return null }
  const parsed = plugin.parse(data, info)
  if (parsed == null) { return null }
  return { ...info, ...parsed }
}
export const xparse: (input: string, cache?: BaseCache) => [
  Plugin?, ResolvedInfo?, Promise<ResolvedInfo | null>?, Promise<{} | null>?, Promise<ResolvedInfo & ParsedInfo | null>?
] = function* (input: string, $cache = cache) {
  if (!(input.length > 2)) { return }
  const resolved = resolve(input)
  if (resolved == null) { return }
  const plugin: Plugin = get(resolvedToPlugin, resolved)
  yield plugin
  yield resolved
  const redirectedPromise = tryRedirect(resolved)
  yield redirectedPromise
  if (redirectedPromise != null) { return }
  const dataPromise = $then(voidPromise, () => plugin.fetch($cache, resolved))
  yield dataPromise
  const parsedPromise: ReturnType<typeof parse> = $then(dataPromise, data => {
    if (data == null) { return null }
    const parsed = plugin.parse(data, resolved)
    if (parsed == null) { return null }
    return { ...resolved, ...parsed }
  })
  $then(parsedPromise, null, noop)
  yield parsedPromise
} as any
export const definePlugin = <T extends {}>(plugin: DefinePlugin<T>): Plugin<T> => {
  if (typeof plugin.parse !== 'function') {
    const handleMap = plugin.parse
    const handleKeys: (keyof typeof defaultMap)[] = filter(keys(handleMap), key => key !== 'title')
    const defaultMap: Omit<ParsedInfo, 'title'> = fromEntries(from(handleKeys, key => [key, void 0])) as any
    plugin.parse = (data, info) => {
      const title = handleMap.title(data, info)
      if (title == null) { return }
      const result: ParsedInfo = { title, ...defaultMap }
      for (const key of handleKeys) {
        try { result[key] = handleMap[key]!(data, info)! }
        catch (e) { reportError(e) }
      }
      return result
    }
  }
  assert?.<Plugin<T>>(plugin)
  freeze(plugin)
  const { resolve } = plugin
  defineRoute(routeMap, plugin.path, path => {
    const info = call(resolve, plugin, path)
    if (info != null) {
      set(resolvedToPlugin, info, plugin)
      return info
    }
  })
  pluginList[pluginList.length] = plugin
  return plugin
}
export const definePluginComponent = <T extends {}>(
  plugin: Plugin<T>, component: Component<T>
) => {
  set(pluginToComponent, plugin, component)
  return component
}
export const getPluginComponent = <T extends {}>(
  plugin: Plugin<T>
): Component<T> | undefined => get(pluginToComponent, plugin)

export const redirectPlugin: Pick<Plugin<{
  plugin: Plugin, data: any, info: ResolvedInfo
}>, 'fetch' | 'parse'> = {
  async fetch(cache, $info) {
    const url = await redirect($info.url)
    if (url == null) { return }
    const info = resolve(url)
    if (info == null) { return }
    const plugin: Plugin = get(resolvedToPlugin, info)
    const data = await plugin.fetch(cache, info)
    return { plugin, data, info }
  },
  parse({ plugin, data, info }, _) {
    return plugin.parse(data, info)
  }
}