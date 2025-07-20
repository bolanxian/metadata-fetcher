
import { on, off } from 'bind:utils'
import { init as initConfig } from './config'
import type { ICache } from '@/meta-fetch/mod'
import { init, NoCache, FsCache, WebCache } from '@/meta-fetch/mod'
import './utils/extra'

const TARGET = import.meta.env.TARGET
const SSR = TARGET == 'server'
const PAGES = TARGET == 'pages'

export const ready = SSR || PAGES ? (async () => {
  let $fetch = SSR ? fetch : null!
  let cache: ICache
  if (SSR) {
    cache = await FsCache.create('./__cache__')
  } else if (PAGES) {
    const $grant = new Promise<CustomEvent | void>(ok => {
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
    $fetch = (await $grant)?.detail?.GM_fetch
    cache = $fetch != null ? await WebCache.create() : new NoCache()
  } else {
    cache = new NoCache()
  }
  init({ cache, fetch: $fetch })
  await initConfig()
})() : null!
