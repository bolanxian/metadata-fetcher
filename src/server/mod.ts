
export * from './core'

import { resolve, extname } from 'node:path/posix'
import { readFile } from 'node:fs/promises'
import { call } from 'bind:core'
import { $then, split } from 'bind:utils'
import { startsWith, slice, includes, replaceAll } from 'bind:String'
import { load as cheerioLoad } from 'cheerio'

import { handleRequest as handleRequestBbdown } from '@/utils/bbdown'
import { default as checkVersion } from '@/utils/check-version.js?raw'
import { parseToStreamJson } from '@/utils/stream-json'
import { S } from '@/components/app.vue'
import { ready } from '@/init'
import { join } from '@/bind'

import {
  name, hostbase, pathbase, loadNodeServer, afterListen,
  type Server, type LocalAddr, serverInst, allowOrigin,
  initCore, server, TYPE, types, $, isLocalHostOrigin,
  $redirect, $error,
} from './core'
import { fileMap } from './file'
import { initHtml, renderToHtml } from './render'
import.meta.glob(['./*'], { eager: true })

import type { AddressInfo as NodeAddr } from 'node:net'
declare const { ReadableStream }: typeof import('node:stream/web')
await ready

let runtime = 'unknown'
switch (`${typeof Deno}:${typeof Bun}`) {
  case 'undefined:undefined': runtime = 'node'; break
  case 'object:undefined': runtime = 'deno'; break
  case 'undefined:object': runtime = 'bun'; break
}

const $clone = Response.prototype.clone
const defineStaticFile = (name: string, type: string, data: BodyInit) => {
  const resp = new Response(data, {
    headers: {
      server,
      [TYPE]: type,
      'cache-control': 'public, max-age=86400'
    }
  })
  $[name] = (ctx) => call($clone, resp)
}

export const init = async () => {
  initCore()
  const rawHtml = await readFile('./dist/index.html', { encoding: 'utf8' })
  initHtml(rawHtml)
  const $ = cheerioLoad(rawHtml)
  for (const el of $('link[rel="@app-asset"]')) {
    const href = $(el).attr('href')!
    const ext = slice(extname(href), 1)
    const data = await readFile(`./dist/${href}`)
    defineStaticFile(slice(href, 1), types[ext as keyof typeof types] ?? '', data)
  }
  defineStaticFile('favicon', types.svg, await readFile('./dist/favicon.svg'))
  defineStaticFile('check-version', types.js, checkVersion)
}

let bbdownCwd: string
$['bbdown'] = ({ request, remoteAddr }) => {
  const { headers } = request
  if (!isLocalHostOrigin(remoteAddr, headers)) {
    return $error(403, name)
  }
  if (headers.get('upgrade') !== 'websocket') {
    return $error(426, name)
  }
  bbdownCwd ??= resolve('./__download__/')
  return handleRequestBbdown(request, bbdownCwd) ?? $error(400, name)
}

$['json'] = ({ url }) => {
  const input = url.searchParams.get('.') ?? ''
  const body: ReadableStream = ReadableStream.from(parseToStreamJson(input)) as any
  return new Response(body, {
    headers: { server, [TYPE]: types.json }
  })
}

function* xbatch(params: Iterable<[string, string]>) {
  for (const [name, value] of params) {
    if (!name || name[0] === '.') { continue }
    yield* split(S, name)
    if (value) { yield* split(S, value) }
  }
}
$['batch'] = ({ url }) => {
  const params = url.searchParams
  const type = params.get('.type')
  if (type != null) {
    return renderToHtml(`batch:${type}`, join(xbatch(params), ' '))
  }
  return $error(400, name)
}

const fetch = (request: Request, remoteAddr: string) => {
  const _origin = request.headers.get('origin')
  if (!(_origin == null || _origin in allowOrigin)) {
    return $error(403, name)
  }
  const url = new URL(request.url)
  const { hostname, pathname } = url
  let base: '/' | typeof pathbase | undefined
  if (startsWith(hostname, hostbase)) {
    base = '/'
  } else if (startsWith(pathname, pathbase)) {
    base = pathbase
  }
  if (base != null) {
    const path = slice(pathname, base.length)
    switch (path[0]) {
      case '.': {
        const fn = $[slice(path, 1)]
        if (fn != null) {
          return fn({ request, remoteAddr, url, 0: path })
        }
      } break
      case '!': {
        const guid = slice(path, 1)
        const file = fileMap.get(guid as any)
        if (file == null) { return $error(404, name) }
        return renderToHtml(`dialog:${guid}`, file)
      }
      default: {
        switch (path) {
          case 'favicon.ico':
            return $redirect(`${base}.favicon`)
          case 'announce':
          case 'robots.txt':
            return $error(404, name)
        }
        if (includes(path, '/')) {
          const nextPath = replaceAll(path, '/', '%2F')
          const search = replaceAll(url.search, '?', '%3F')
          return $redirect(`${base}${nextPath}${search}`)
        }
        return renderToHtml('default', decodeURIComponent(path))
      }
    }
  } else {
    switch (pathname) {
      case '/':
        return $redirect(pathbase)
      case '/favicon.ico':
        return $redirect(`${pathbase}.favicon`)
      case '/announce':
      case '/robots.txt':
        return $error(404, name)
    }
  }
  return $error(404, name)
}

const onError = (e: any) => { reportError(e); return $error(500, name) }
export const serve = (port = 6702, hostname = '127.0.0.1') => {
  if (serverInst != null) { throw null }
  let server: Server
  let localAddr: Promise<LocalAddr>
  switch (runtime) {
    default: localAddr = $then(loadNodeServer(), ({ serve }) => new Promise((ok) => {
      server = serve({
        port, hostname,
        /**
         * `@hono/node-server@1.19.11` 在
         * 「轻量 Response + 复用 init / init.headers 普通对象 + body 长度不同」
         * 的场景下会出现 Content-Length 与实际 body 不匹配的回归问题
         * <https://github.com/honojs/node-server/pull/309>
         */
        overrideGlobalObjects: false,
        fetch(request, env) {
          const info = env.incoming.socket.address() as NodeAddr
          return fetch(request, info.address)
        }
      }, ({ address, port }) => ok({ hostname: address, port }))
    }))
      break
    case 'deno': localAddr = new Promise((onListen) => {
      server = Deno.serve({
        port, hostname,
        onListen,
        handler(request, { remoteAddr: { hostname } }) {
          return fetch(request, hostname)
        },
        onError
      })
    })
      break
    case 'bun': localAddr = new Promise((ok) => {
      server = Bun.serve({
        port, hostname,
        idleTimeout: 45,
        fetch(request) {
          const { address } = this.requestIP(request)!
          return fetch(request, address)
        },
        error: onError
      })
      setTimeout(ok, 0, server)
    })
      break
  }
  if (localAddr != null) {
    return afterListen(server!, localAddr)
  }
}
