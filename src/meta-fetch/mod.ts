
export * from './cache'
export * from './fetch'
export * from './discover'
export * from './router'
export * from './plugin'
import './platforms/$'
import './platforms/bilibili-video'
import.meta.glob('./platforms/*', { eager: true })

import { BaseCache, initCache } from './cache'
import { initFetch } from './fetch'

export const defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
export type Init = { cache: BaseCache, fetch: typeof fetch, userAgent?: string }
export let init = ({ cache, fetch: _fetch, userAgent }: Init) => {
  init = null!
  userAgent ??= defaultUserAgent

  initCache(cache)
  initFetch(_fetch, userAgent)
}
