
/// <reference path="../src/vite-env.d.ts" />
const basename = 'metadata-fetcher'
const hostbase = `${basename}.`
const pathbase = `/${basename}/`
import { platform } from 'node:process'
import { spawn } from 'node:child_process'
import { opendir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { STATUS_CODES } from 'node:http'
import {
  name, ready, $string, $array, call, getOwn,
  test, match, replace, split, encodeText as encode, join,
  redirect, discoverMap, discoverHttpMap, resolve, xparse,
  config, readConfig, writeConfig, render, renderBatch,
  S, P, renderToHtml, createBatchParams,
  handleRequestBbdown, illustId, illustName
} from '../dist/main.ssr.js'
import { getCpu, getCpuUsage, getMemoryUsage, getOs, getRuntime, getPm } from './info.js'
await ready

const { stringify } = JSON, { log, error } = console
const { trim, concat, startsWith, endsWith, slice, includes, lastIndexOf, replaceAll } = $string
const { indexOf } = $array
const types = {
  __proto__: null,
  css: 'text/css',
  html: 'text/html',
  js: 'text/javascript',
  json: 'application/json',
  txt: 'text/plain',
  svg: 'image/svg+xml',
  woff2: 'font/woff2',
  osdx: 'application/opensearchdescription+xml',
  suggestions: 'application/x-suggestions+json'
}

let runtime = 'unknown'
switch (`${typeof Deno}:${typeof Bun}`) {
  case 'object:undefined': runtime = 'deno'; break
  case 'undefined:object': runtime = 'bun'; break
}

const _html = split(
  /<title>.*?<\/title>|(?=><!--#app-->)|<!--#app-->/,
  await readFile('./dist/index.html', { encoding: 'utf8' })
)
_html[0] = `\
${trim(_html[0])}

<link rel="icon" type="${types.svg}" href="./.favicon">
<link rel="search" type="${types.osdx}" href="./.opensearch" title="${name}">
`
const [html0, html1, html2, html3] = _html
const server = navigator.userAgent
/** @type {Record<string, (ctx: { request: Request, remoteAddr: string, url: URL, 0: string }) => Promise<Response> | Response>} */
export const $ = { __proto__: null }
let url, origin, serverInst

const $clone = Response.prototype.clone
const defineStaticFile = (name, type, data) => {
  const resp = new Response(data, {
    headers: {
      server,
      'content-type': type,
      'cache-control': 'public, max-age=86400'
    }
  })
  $[name] = (ctx) => call($clone, resp)
}
for await (const dirent of await opendir('./dist/.assets/')) {
  if (!dirent.isFile()) { continue }
  const { name } = dirent
  const data = await readFile(`./dist/.assets/${name}`)
  const type = types[slice(name, lastIndexOf(name, '.') + 1)] ?? ''
  defineStaticFile(`assets/${name}`, type, data)
}
defineStaticFile('favicon', types.svg, await readFile('./dist/favicon.svg'))

$.opensearch = (ctx) => {
  return new Response(`\
<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${name}</ShortName>
  <Description>获取元数据</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image type="${types.svg}">${url}.favicon</Image>
  <Url type="${types.html}" template="${url}.search?.={searchTerms}"/>
  <Url type="${types.suggestions}" template="${url}.searchsuggestions?.={searchTerms}"/>
</OpenSearchDescription>
`, $.opensearch.init ??= {
    headers: { server, 'content-type': types.osdx }
  })
}
const searchAsRedirect = async (url, base) => {
  const target = await redirect(url)
  if (target == null) { return $html('default', url) }
  return $redirect(new URL(`./.search?.=${encodeURIComponent(target)}`, base).href)
}
$.search = ({ url }) => {
  const input = trim(url.searchParams.get('.') ?? '')
  if (input === '') { return $redirect(new URL('./', url).href) }
  const resolved = resolve(input)
  let id = resolved?.id
  if (id != null) {
    if (test(P, id)) {
      return $redirect(new URL(`./${encodeURIComponent(id)}`, url).href)
    }
    if (id[0] === '@') {
      return searchAsRedirect(resolved.url, url)
    }
  }
  return $html('default', input)
}
$.searchsuggestions = ({ url }) => {
  const input = trim(url.searchParams.get('.') ?? '')
  const id = resolve(input)?.id
  const ret = id != null && test(P, id) ? [id] : []
  return new Response(stringify([input, ret]), $.searchsuggestions.init ??= {
    headers: { server, 'content-type': types.suggestions }
  })
}

let REG_ID
let init_reg_id = () => {
  init_reg_id = null
  const ret = [], REG1 = /^\^|\$$/g, REG2 = /^\w+$/
  for (const keys of [discoverMap.keys(), discoverHttpMap.keys()]) {
    for (let { source } of keys) {
      source = replace(REG1, source, '')
      if (test(REG2, source)) { continue }
      if (endsWith(source, '(?=$|[?#])')) {
        source = slice(source, 0, -10)
      }
      ret[ret.length] = source
    }
  }
  return RegExp(join(ret, '|'), 'g')
}
function* matchId(data) {
  for (let id of match(REG_ID, data) ?? []) {
    id = resolve(id)?.id
    if (id != null) { yield id }
  }
}
function* matchIllust(line) {
  const id = illustId(line)
  if (id != null) { yield id }
}
async function* xmatcher(getIter, ctx, params) {
  try {
    yield encode('chcp 65001\r\n')
    if (params.get('mode') === 'illust') {
      for await (const line of getIter(ctx)) {
        const name = await illustName(line)
        if (name == null) { continue }
        yield encode(`ren "${line}" "${name}"\r\n`)
      }
    } else {
      for await (const line of getIter(ctx)) {
        let name = line, ext = '', i = lastIndexOf(line, '.')
        if (i > 0) { name = slice(line, 0, i); ext = slice(line, i) }
        let id; for (id of matchId(name)) { break }
        if (id == null) { continue }
        let result; for await (result of renderBatch([id], 'name')) { break }
        name = result?.error === null ? result.value : `[${id}]`
        yield encode(`ren "${line}" "${name}${ext}"\r\n`)
        if (result?.error != null) {
          yield encode(`rem "${result.error}"\r\n`)
        }
      }
    }
    yield encode('exit')
  } catch (e) {
    reportError(e)
    yield encode(':error')
  }
}
const matcher = (getIter) => async (ctx) => {
  REG_ID ??= init_reg_id()
  if (!startsWith(ctx.remoteAddr, '127.')) {
    return $error(403, name)
  }
  const params = ctx.url.searchParams
  if (params.get('output') === 'batch') {
    return new Response(ReadableStream.from(xmatcher(getIter, ctx, params)), {
      headers: { server, 'content-type': `${types.txt};charset=UTF-8` }
    })
  }
  let matchFn = matchId
  if (params.get('mode') === 'illust') {
    matchFn = matchIllust
  }
  const set = new Set(); let i = 0
  loop: for await (const data of getIter(ctx)) {
    for (let id of matchFn(data)) {
      set.add(id)
      if (128 < ++i) {
        set.add('@truncate')
        break loop
      }
    }
  }
  const batch = params.get('batch') ?? '.id'
  const location = new URL(`./.batch?${createBatchParams(batch, set)}`, ctx.url).href
  return $redirect(location)
}
$.file = matcher(async function* ({ url }) {
  const data = await readFile(url.searchParams.get('path'), { encoding: 'utf-8' })
  for (const line of split(S, data)) { yield line }
})
$.directory = matcher(async function* ({ url }) {
  const dir = await opendir(url.searchParams.get('path'))
  try {
    for await (let dirent of dir) {
      yield dirent.name
    }
  } finally {
    await dir.close()
  }
})
$.bbdown = ({ request, remoteAddr }) => {
  if (!startsWith(remoteAddr, '127.')) {
    return $error(403, name)
  }
  if (request.headers.get('upgrade') !== 'websocket') {
    return $error(426, name)
  }
  $.bbdown.cwd ??= fileURLToPath(import.meta.resolve('../__download__/'))
  return handleRequestBbdown(request, $.bbdown.cwd) ?? $error(400, name)
}
$.info = ({ remoteAddr, request }) => {
  if (!startsWith(remoteAddr, '127.')) {
    return $error(403, name)
  }
  if (request.headers.get('accept') === 'text/event-stream') {
    let timer
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encode(`\
event: info
data: ${stringify({ remoteAddr, cpu: getCpu(), os: getOs(), runtime: getRuntime(), pm: getPm() })}

`))
        const fn = () => {
          controller.enqueue(encode(`\
event: usage
data: ${stringify({ cpu: getCpuUsage(), memory: getMemoryUsage() })}

`))
        }
        timer = setInterval(fn, 500)
        fn()
      },
      cancel(reason) {
        clearInterval(timer)
      }
    }), $.info.initstream ??= {
      headers: { server, 'content-type': 'text/event-stream' }
    })
  }
  return new Response(stringify({
    remoteAddr, cpu: getCpu(),
    cpuUsage: getCpuUsage(),
    memoryUsage: getMemoryUsage(),
    os: getOs(), runtime: getRuntime(), pm: getPm(),
    reg_id: REG_ID?.source ?? null
  }), $.info.init ??= {
    headers: { server, 'content-type': types.json }
  })
}
$.config = async ({ request, remoteAddr }) => {
  if (request.method === 'POST') {
    if (!(startsWith(remoteAddr, '127.') && origin === request.headers.get('origin'))) {
      return $error(403, name)
    }
    const config = await request.json()
    await writeConfig(config)
    return new Response(null, $.config.initWrite ??= {
      status: 204, headers: { server }
    })
  }
  const config = await readConfig()
  return new Response(stringify(config), $.config.init ??= {
    headers: { server, 'content-type': types.json }
  })
}
async function* _json(input) {
  let step = 0
  try {
    const [, resolved, redirected, , parsedPromise] = xparse(input)
    yield encode(`{
  "resolved":${stringify(resolved ?? null)}`)
    step = 1
    yield encode(`,
  "redirected":${stringify((await redirected) ?? null)}`)
    step = 2
    const parsed = await parsedPromise
    yield encode(`,
  "parsed":${stringify(parsed ?? null)}`)
    step = 3
    yield encode(`,
  "rended":${stringify(parsed != null ? render(parsed) : null)}
}`)
  } catch (e) {
    error(e)
    yield encode(`${step > 0 ? ',' : '{'}
  "error":${stringify({ step, message: e.message ?? 'unknown error' })}
}`)
  }
}
$.json = ({ url }) => {
  return new Response(ReadableStream.from(_json(url.searchParams.get('.') ?? '')), $.json.init ??= {
    headers: { server, 'content-type': types.json }
  })
}
$.dialog = ({ url }) => {
  const params = url.searchParams
  const type = params.get('type')
  const path = params.get('path')
  return $html(`dialog:${type}`, path)
}
$.id = ({ 0: input, url }) => {
  const params = createBatchParams(input, url.searchParams.getAll('id'))
  const location = new URL(`./.batch?.from=legacy&${params}`, url).href
  return $redirect(location)
}
$.list = $.name = $.escape = ({ 0: input, url }) => {
  const params = createBatchParams(slice(input, 1), url.searchParams.getAll('id'))
  const location = new URL(`./.batch?.from=legacy&${params}`, url).href
  return $redirect(location)
}
function* xbatch(params) {
  for (const [name, value] of params) {
    if (!name || name[0] === '.') { continue }
    yield* split(S, name)
    if (value) { yield* split(S, value) }
  }
}
$.batch = ({ url }) => {
  const params = url.searchParams
  const type = params.get('.type')
  if (type != null) {
    return $html(`batch:${type}`, join(xbatch(params), ' '))
  }
  {
    const _ = createBatchParams(params.get('type'), params.getAll('id'))
    const location = new URL(`./.batch?.from=legacy&${_}`, url).href
    return $redirect(location)
  }
}
const $html = async (mode, input) => {
  let { status, head, attrs, app } = await renderToHtml(mode, input)
  head ??= `<title>${name}</title>`
  const html = concat(html0, head, html1, attrs, html2, app, html3)
  return new Response(html, {
    status, headers: $html.init ??= {
      server, 'content-type': types.html
    }
  })
}
const $redirect = (location, status = 302) => new Response(null, { status, headers: { server, location } })
export const $error = (status, name, title) => {
  title ??= `${status} ${getOwn(STATUS_CODES, status) ?? 'Unknown'}`
  return new Response(`\
<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
  </head>
  <body>
    <center><h1>${title}</h1></center>
    <hr>
    <center>${name}</center>
  </body>
</html>`, {
    status, headers: { server, 'content-type': `${types.html};charset=UTF-8` }
  })
}

export const open = await (async () => {
  let isBrowser = false
  let command, $args, i
  switch (platform) {
    case 'win32': try {
      if (config.defaultBrowser == null) { throw null }
      const [cmd, ...args] = getOwn(config.browsers, config.defaultBrowser).args
      i = indexOf(args, '%1')
      if (!(i >= 0)) { (void 0)() }
      command = cmd; $args = args
      isBrowser = true
    } catch (cause) {
      command = 'explorer'; $args = ['']; i = 0
      error(new TypeError('获取默认浏览器失败', { cause }))
    } break
  }
  if (command != null && $args != null) {
    isBrowser && log('浏览器:', command)
    return (url) => new Promise(ok => {
      const [...args] = $args; args[i] = url
      const process = spawn(command, args, { stdio: 'inherit', shell: false })
      process.on('exit', ok)
    })
  }
  return async (url) => 1
})()

const fetch = (request, remoteAddr) => {
  const url = new URL(request.url)
  const { hostname, pathname } = url
  /** @type {'/' | typeof pathbase | undefined} */
  let base
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
        const nextPath = decodeURIComponent(slice(path, 1))
        return $redirect(`${base}${nextPath}`)
      }
      default: {
        switch (path) {
          case 'favicon.ico':
            return $redirect(`${base}.favicon`)
          case 'announce':
            return $error(404, name)
        }
        if (includes(path, '/')) {
          const nextPath = replaceAll(path, '/', '%2F')
          const search = replaceAll(url.search, '?', '%3F')
          return $redirect(`${base}${nextPath}${search}`)
        }
        return $html('default', decodeURIComponent(path))
      }
    }
  } else {
    switch (pathname) {
      case '/':
        return $redirect(pathbase)
      case '/favicon.ico':
        return $redirect(`${pathbase}.favicon`)
      case '/announce':
        return $error(404, name)
    }
  }
  return $error(404, name)
}
const afterListen = async (serverInst, localAddrPromise) => {
  let { hostname, port } = await localAddrPromise
  if (hostname === '0.0.0.0') { hostname = '127.0.0.1' }
  origin = `http://${hostbase}localhost:${port}`
  url = `${origin}/`
  log(`Listening on ${url}`)
  return { server: serverInst, hostname, port, url }
}
const onError = (e) => { error(e); return $error(500, name) }
export const main = (port = 6702, hostname = '127.0.0.1') => {
  if (serverInst != null) { (void 0)() }
  let localAddrPromise
  switch (runtime) {
    case 'deno': localAddrPromise = new Promise((onListen) => {
      serverInst = Deno.serve({
        port, hostname,
        onListen,
        handler(request, { remoteAddr: { hostname } }) {
          return fetch(request, hostname)
        },
        onError
      })
    })
      break
    case 'bun': localAddrPromise = new Promise((ok) => {
      serverInst = Bun.serve({
        port, hostname,
        idleTimeout: 45,
        fetch(request) {
          const { address } = this.requestIP(request)
          return fetch(request, address)
        },
        error: onError
      })
      setTimeout(ok, 0, serverInst)
    })
      break
  }
  if (localAddrPromise != null) {
    return afterListen(serverInst, localAddrPromise)
  }
}

for (const type of ['file', 'directory']) {
  addEventListener(`tray:open:${type}`, e => {
    if (url == null) { return }
    const nextPath = `.dialog?${new URLSearchParams({ type, path: e.detail })}`
    open(`${url}!${encodeURIComponent(nextPath)}`)
  })
}

export default { fetch }
