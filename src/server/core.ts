
export const name = 'Metadata Fetcher'
export const basename = 'metadata-fetcher'
export const hostbase = `${basename}.`
export const pathbase = `/${basename}/`
export const loadNodeServer = () => import('@/deps/dep-node-server')

import { platform } from 'node:process'
import { spawn } from 'node:child_process'

import { split } from 'bind:utils'
import { trim } from 'bind:String'
import { freeze } from 'bind:Object'
import { indexOf } from 'bind:Array'

import { S } from '@/components/app.vue'
import { config, getBrowser, getBrowserArgs } from '@/config'
import type { ServerType as NodeServer } from '@hono/node-server'
const { log, error } = console

export type Server = NodeServer | Deno.HttpServer<Deno.NetAddr> | Bun.Server<void>
export type LocalAddr = { hostname: string, port: number }

export let host: string, origin: string, url: string
export let serverInst: Server
export let localAddrPromise: Promise<LocalAddr>

export const server = navigator.userAgent
export const CSP = 'content-security-policy'
export const CSP_VALUE = `default-src 'self';img-src * data: blob:;style-src 'self' 'unsafe-inline';`
export const TYPE = 'content-type'
export const types = {
  __proto__: null!,
  css: 'text/css',
  html: 'text/html',
  js: 'text/javascript',
  json: 'application/json',
  txt: 'text/plain',
  svg: 'image/svg+xml',
  woff2: 'font/woff2',
  osdx: 'application/opensearchdescription+xml',
  suggest: 'application/x-suggestions+json',
  trending: 'application/x-trending+json',
} as const

export const localAddr: Record<string, null> = { __proto__: null }
export const allowOrigin: Record<string, null> = { __proto__: null }
export let open: ((url: string) => Promise<number | null>) | undefined
export const initCore = () => {
  for (const addr of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    localAddr[addr] = null
  }
  freeze(localAddr)

  const _allowOrigin = trim(config.allowOrigin)
  for (const origin of _allowOrigin ? split(S, _allowOrigin) : []) {
    if (!origin) { continue }
    allowOrigin[origin] = null
  }

  const browser = getBrowser()
  const args = getBrowserArgs(platform, browser)
  if (browser != null) {
    log('浏览器:', browser.name)
  } else {
    error('获取默认浏览器失败')
  }
  open = args != null ? (url: string) => new Promise<number | null>(ok => {
    const [command, ...$args] = args
    const i = indexOf($args, '$1')
    if (!(i >= 0)) { throw new TypeError('Not found: "$1"', { cause: args }) }
    $args[i] = url
    const process = spawn(command!, $args, { stdio: 'inherit', shell: false })
    process.on('exit', ok)
  }) : void 0
}

export type RouteCtx = { request: Request, remoteAddr: string, url: URL, 0: string }
export type RouteFn = (ctx: RouteCtx) => Promise<Response> | Response
export const $: Record<string, RouteFn> = { __proto__: null! }
export const isLocalHost = (remoteAddr: string, headers: Headers) => {
  return remoteAddr in localAddr && host === headers.get('host')
}
export const isOrigin = (headers: Headers) => {
  return origin === headers.get('origin')
}
export const isLocalHostOrigin = (remoteAddr: string, headers: Headers) => {
  return remoteAddr in localAddr && host === headers.get('host') && origin === headers.get('origin')
}
export const isNavigateDocument = (headers: Headers) => {
  return headers.get('Sec-Fetch-Mode') === 'navigate' && headers.get('Sec-Fetch-Dest') === 'document'
}

export const afterListen = async (server: typeof serverInst, localAddr: typeof localAddrPromise) => {
  serverInst = server
  localAddrPromise = localAddr
  let { hostname, port } = await localAddr
  if (hostname === '0.0.0.0') { hostname = '127.0.0.1' }
  // 高危操作专用 host / origin
  host = `${hostbase}localhost:${port}`
  origin = `http://${host}`
  url = `${origin}/`
  allowOrigin[origin] = null
  log(`Listening on ${url}`)
  return { server, hostname, port, host, origin, url }
}
