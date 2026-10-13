
export { bindCall, call, bind } from 'bind:core'
export { hasOwn, getOwn, $then, encodeText, decodeText, test, match, replace, split, on, off } from 'bind:utils'
export * from '@/bind'
export { getKnownFolder, createLnk } from '@/utils/reg-utils'
export { xparse } from '@/meta-fetch/mod'
export { render, renderBatch } from '@/render'

import { ready as readyTemporal } from '@/utils/temporal'
import { ready as readyRegUtils } from '@/utils/reg-utils'
import { init } from '@/init'
await Promise.all([init(), readyTemporal, readyRegUtils])

export const loadServe = async () => {
  const mod = await import('@/deps/ssr-server')
  mod.init()
  return mod
}
