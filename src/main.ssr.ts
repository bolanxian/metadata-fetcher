
export { bindCall, call, bind } from 'bind:core'
export { hasOwn, getOwn, $then, encodeText, decodeText, test, match, replace, split, on, off } from 'bind:utils'
export * from './bind'
export { xparse } from '@/meta-fetch/mod'
export { render, renderBatch } from './render'

import * as serve from './server/mod'
export const loadServe = async () => serve

import { ready } from './init'
await ready
