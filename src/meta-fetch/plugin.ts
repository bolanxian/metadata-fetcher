
import type { DefineComponent, ExtractPropTypes, Prop } from 'vue'
import { noop, voidPromise } from '@/bind'
import { call } from 'bind:core'
import { $then } from 'bind:utils'
import { freeze } from 'bind:Object'
import { get, set } from 'bind:WeakMap'
import { redirect } from './fetch'
import { xresolveDiscover } from './discover'
import { type RouteMap, defineRoute, resolveRoute } from './router'

export interface Plugin<T extends {} = {}> {
  name: string
  path: string
  resolve(path: string[]): ResolvedInfo | undefined
  fetch(info: ResolvedInfo): Promise<T | undefined>
  parse(data: T, info: ResolvedInfo): ParsedInfo | undefined
}
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
  publishDate?: string
  thumbnailUrl?: string
  relatedUrl?: string
  keywords?: string
  description?: string
}
export const resolvedToPlugin: WeakMap<ResolvedInfo, Plugin> = new WeakMap()
export const pluginToComponent: WeakMap<
  Plugin, DefineComponent<ExtractPropTypes<{ data: Prop<{}> }>, {}, any>
> = new WeakMap()
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
  const data = await plugin.fetch(info)
  if (data == null) { return null }
  const parsed = plugin.parse(data, info)
  if (parsed == null) { return null }
  return { ...info, ...parsed }
}
export const xparse: (input: string) => [
  Plugin?, ResolvedInfo?, Promise<ResolvedInfo | null>?, Promise<{} | null>?, Promise<ResolvedInfo & ParsedInfo | null>?
] = function* (input: string) {
  if (!(input.length > 2)) { return }
  const resolved = resolve(input)
  if (resolved == null) { return }
  const plugin: Plugin = get(resolvedToPlugin, resolved)
  yield plugin
  yield resolved
  const redirectedPromise = tryRedirect(resolved)
  yield redirectedPromise
  if (redirectedPromise != null) { return }
  const dataPromise = $then(voidPromise, () => plugin.fetch(resolved))
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
export const definePlugin = <T extends {}>(plugin: Plugin<T>) => {
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
  async fetch(_info) {
    const url = await redirect(_info.url)
    if (url == null) { return }
    const info = resolve(url)
    if (info == null) { return }
    const plugin: Plugin = get(resolvedToPlugin, info)
    const data = await plugin.fetch(info)
    return { plugin, data, info }
  },
  parse({ plugin, data, info }, _) {
    return plugin.parse(data, info)
  }
}