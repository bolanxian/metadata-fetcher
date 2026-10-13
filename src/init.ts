
import { on, off } from 'bind:utils'
import { init as initConfig } from './config'
import type { BaseCache } from '@/meta-fetch/mod'
import { init as $init, NoCache, FsCache, WebCache } from '@/meta-fetch/mod'
import './utils/extra'

const TARGET = import.meta.env.TARGET
const SSR = TARGET == 'server'
const CSR = TARGET == 'client'
const PAGES = TARGET == 'pages'

export const init = async () => {
  let $fetch = SSR ? fetch : null!
  let cache: BaseCache
  if (SSR) {
    cache = await FsCache.create('./__cache__')
  } else if (PAGES) {
    const $grant = await waitGrant()
    $fetch = $grant?.detail?.GM_fetch
    cache = $fetch != null ? await WebCache.create() : new NoCache()
  } else {
    cache = null!
  }
  if (SSR || PAGES) {
    $init({ cache, fetch: $fetch })
    await initConfig()
  }
}

export const waitVisible = CSR ? (
  () => document.visibilityState !== 'visible' ? new Promise<Event>(ok => {
    const type = 'visibilitychange'
    const done = (e: Event) => {
      if (document.visibilityState !== 'visible') { return }
      ok(e)
      off(document, type, done)
    }
    on(document, type, done)
  }) : null
) : null!

export const waitGrant = PAGES ? (
  () => new Promise<CustomEvent | void>(ok => {
    const type = 'external:tampermonkey:grant'
    if (document.readyState === 'complete') { return ok() }
    const target = window, done = (e: any) => {
      ok(e.type === type ? e : null)
      off(target, type, done)
      off(target, 'load', done)
    }
    on(target, type, done)
    on(target, 'load', done)
  })
) : null!
