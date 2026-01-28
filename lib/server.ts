
const basename = 'metadata-fetcher'
const hostbase = `${basename}.`
const pathbase = `/${basename}/`
import { platform } from 'node:process'
import { spawn } from 'node:child_process'
import { extname } from 'node:path/posix'
import { opendir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { STATUS_CODES } from 'node:http'
import {
  name, ready, cheerioLoad, $string, $array,
  call, getOwn, encodeText as encode, join,
  test, match, replace, split,
  type FsCache, cache, redirect,
  discoverMap, discoverHttpMap,
  xresolve, resolve, xparse,
  config, readConfig, writeConfig,
  render, renderBatch,
  S, P, createBatchParams,
  handleRequestBbdown,
  illustId, illustName,
  checkVersion, renderToHtml,
} from '@/main.ssr'
import { getCpu, getCpuUsage, getMemoryUsage, getOs, getRuntime, getPm } from './info.ts'
declare const { ReadableStream }: typeof import('node:stream/web')
await ready

type RouteCtx = { request: Request, remoteAddr: string, url: URL, 0: string }
type RouteFn = (ctx: RouteCtx) => Promise<Response> | Response
export const $: Record<string, RouteFn> = { __proto__: null! }

const { stringify } = JSON, { log, error } = console
const { trim, concat, startsWith, endsWith, slice, includes, lastIndexOf, replaceAll } = $string
const { indexOf } = $array
const server = navigator.userAgent
const TYPE = 'content-type'
const types = {
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

let runtime = 'unknown'
switch (`${typeof Deno}:${typeof Bun}`) {
  case 'object:undefined': runtime = 'deno'; break
  case 'undefined:object': runtime = 'bun'; break
}

const allowOrigin: Record<string, null> = { __proto__: null }
const _allowOrigin = trim(config.allowOrigin)
for (const origin of _allowOrigin ? split(S, _allowOrigin) : []) {
  if (!origin) { continue }
  allowOrigin[origin] = null
}

const rawHtml = await readFile('./dist/index.html', { encoding: 'utf8' })
const _html = split(/<title>.*?<\/title>|(?=><!--#app-->)|<!--#app-->/, rawHtml)
_html[0] = `\
${trim(_html[0]!)}

<script defer src="./.check-version"></script>
<link rel="icon" type="${types.svg}" href="./.favicon">
<link rel="search" type="${types.osdx}" href="./.opensearch" title="${name}">
`
const [html0, html1, html2, html3] = _html

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
{
  const $ = cheerioLoad(rawHtml)
  for (const el of $('link[rel="@app-asset"]')) {
    const href = $(el).attr('href')!
    const ext = slice(extname(href), 1)
    const data = await readFile(`./dist/${href}`)
    defineStaticFile(slice(href, 1), types[ext as keyof typeof types] ?? '', data)
  }
}
defineStaticFile('favicon', types.svg, await readFile('./dist/favicon.svg'))
defineStaticFile('check-version', types.js, checkVersion)

$['opensearch'] = (ctx) => {
  return new Response(`\
<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${name}</ShortName>
  <Description>获取元数据</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image type="${types.svg}">${url}.favicon</Image>
  <Url type="${types.html}" template="${url}.search?.={searchTerms}"/>
  <Url type="${types.suggest}" template="${url}.suggest?.={searchTerms}"/>
  <Url type="${types.trending}" template="${url}.suggest"/>
  <Url type="${types.osdx}" rel="self" template="${url}.opensearch"/>
</OpenSearchDescription>
`, {
    headers: { server, [TYPE]: types.osdx }
  })
}
const searchAsRedirect = async (url: string, base?: string | URL) => {
  const target = await redirect(url)
  if (target == null) { return $html('default', url) }
  return $redirect(new URL(`./.search?.=${encodeURIComponent(target)}`, base).href)
}
$['search'] = ({ url }) => {
  const input = trim(url.searchParams.get('.') ?? '')
  if (input === '') { return $redirect(new URL('./', url).href) }
  const resolved = resolve(input)
  let id = resolved?.id
  if (id != null) {
    if (test(P, id)) {
      return $redirect(new URL(`./${encodeURIComponent(id)}`, url).href)
    }
    if (id[0] === '@') {
      return searchAsRedirect(resolved!.url, url)
    }
  }
  return $html('default', input)
}
$['suggest'] = ({ url }) => {
  const _input = url.searchParams.get('.')
  const input = trim(_input ?? '')
  if (!input) {
    const data = stringify([_input, [...cache.keys()]])
    return new Response(data, {
      headers: { server, [TYPE]: types.trending }
    })
  }
  const list = [...xresolve(input)], ids = []
  for (const { displayId } of list) {
    if (test(P, displayId)) { ids[ids.length] = displayId }
  }
  for (const { shortUrl } of list) {
    if (shortUrl) { ids[ids.length] = shortUrl }
  }
  for (const { url } of list) {
    ids[ids.length] = url
  }
  return new Response(stringify([_input, ids]), {
    headers: { server, [TYPE]: types.suggest }
  })
}

let REG_ID: RegExp
let init_reg_id = () => {
  init_reg_id = null!
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
function* matchId(data: string) {
  for (const id of match(REG_ID, data) ?? []) {
    let newId = resolve(id)?.id
    if (newId != null) { yield newId }
  }
}
function* matchIllust(line: string) {
  const id = illustId(line)
  if (id != null) { yield id }
}
type GetIter = (...args: [RouteCtx]) => AsyncIterableIterator<string>
async function* xmatcher(getIter: GetIter, ctx: RouteCtx, params: URLSearchParams) {
  try {
    yield encode('\r\nchcp 65001\r\npause\r\n')
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
    yield encode('pause\r\n')
  } catch (e) {
    reportError(e)
    yield encode(':error\r\n')
  }
}
const matcher = (getIter: GetIter): RouteFn => async (ctx) => {
  if (!startsWith(ctx.remoteAddr, '127.')) {
    return $error(403, name)
  }
  const { headers } = ctx.request
  if (!(headers.get('Sec-Fetch-Dest') === 'document'
    && headers.get('Sec-Fetch-Mode') === 'navigate')) {
    return $error(403, name)
  }
  REG_ID ??= init_reg_id()
  const params = ctx.url.searchParams
  if (params.get('output') === 'batch') {
    return new Response(ReadableStream.from(xmatcher(getIter, ctx, params)) as any as ReadableStream, {
      headers: { server, [TYPE]: `${types.txt};charset=UTF-8` }
    })
  }
  let matchFn = matchId
  if (params.get('mode') === 'illust') {
    matchFn = matchIllust
  }
  const set = new Set<string>(); let i = 0
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
$['file'] = matcher(async function* ({ url }) {
  const data = await readFile(url.searchParams.get('path')!, { encoding: 'utf-8' })
  for (const line of split(S, data)) { yield line }
})
$['directory'] = matcher(async function* ({ url }) {
  const dir = await opendir(url.searchParams.get('path')!)
  try {
    for await (let dirent of dir) {
      yield dirent.name
    }
  } finally {
    await dir.close()
  }
})
let bbdownCwd: string
$['bbdown'] = ({ request, remoteAddr }) => {
  if (!startsWith(remoteAddr, '127.')) {
    return $error(403, name)
  }
  if (request.headers.get('upgrade') !== 'websocket') {
    return $error(426, name)
  }
  bbdownCwd ??= fileURLToPath(import.meta.resolve('../__download__/'))
  return handleRequestBbdown(request, bbdownCwd) ?? $error(400, name)
}
$['info'] = ({ remoteAddr, request }) => {
  if (!startsWith(remoteAddr, '127.')) {
    return $error(403, name)
  }
  if (request.headers.get('accept') === 'text/event-stream') {
    let timer: ReturnType<typeof setTimeout>
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
    }) as any as ReadableStream, {
      headers: { server, [TYPE]: 'text/event-stream' }
    })
  }
  return new Response(stringify({
    remoteAddr, cpu: getCpu(),
    cpuUsage: getCpuUsage(),
    memoryUsage: getMemoryUsage(),
    os: getOs(), runtime: getRuntime(), pm: getPm(),
    routeList: Object.keys($),
    regId: REG_ID?.source ?? null
  }), {
    headers: { server, [TYPE]: types.json }
  })
}
$['config'] = async ({ request, remoteAddr }) => {
  if (request.method === 'POST') {
    if (!(startsWith(remoteAddr, '127.') && origin === request.headers.get('origin'))) {
      return $error(403, name)
    }
    const config = await request.json()
    await writeConfig(config)
    return new Response(null, {
      status: 204, headers: { server }
    })
  }
  const config = await readConfig()
  return new Response(stringify(config), {
    headers: { server, [TYPE]: types.json }
  })
}
$['clear-lru'] = ({ remoteAddr }) => {
  if (!startsWith(remoteAddr, '127.')) {
    return $error(403, name)
  }
  (cache as FsCache).lru.clear()
  return $error(200, name, '已复位')
}
async function* _json(input: string) {
  let step = 0
  try {
    const [, resolved, redirected, , parsedPromise] = xparse(input)
    yield encode(`{
  "resolved":${stringify(resolved ?? null)}`)
    step = 1
    yield encode(`,
  "redirected":${stringify(await redirected ?? null)}`)
    step = 2
    const parsed = await parsedPromise
    yield encode(`,
  "parsed":${stringify(parsed ?? null)}`)
    step = 3
    yield encode(`,
  "rended":${stringify(parsed != null ? render(parsed) : null)}
}`)
  } catch (e: any) {
    error(e)
    yield encode(`${step > 0 ? ',' : '{'}
  "error":${stringify({ step, message: e.message ?? 'unknown error' })}
}`)
  }
}
$['json'] = ({ url }) => {
  return new Response(ReadableStream.from(_json(url.searchParams.get('.') ?? '')) as any as ReadableStream, {
    headers: { server, [TYPE]: types.json }
  })
}
$['dialog'] = ({ url }) => {
  const params = url.searchParams
  const type = params.get('type')
  const path = params.get('path')
  return $html(`dialog:${type}`, path!)
}
$['id'] = ({ 0: input, url }) => {
  const params = createBatchParams(input, url.searchParams.getAll('id'))
  const location = new URL(`./.batch?.from=legacy&${params}`, url).href
  return $redirect(location)
}
$['list'] = $['name'] = ({ 0: input, url }) => {
  const params = createBatchParams(slice(input, 1), url.searchParams.getAll('id'))
  const location = new URL(`./.batch?.from=legacy&${params}`, url).href
  return $redirect(location)
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
    return $html(`batch:${type}`, join(xbatch(params), ' '))
  }
  return $error(400, name)
}
const $html = async (mode: string, input: string) => {
  let { status, head, attrs, app } = await renderToHtml(mode, input)
  head ??= `<title>${name}</title>`
  const html = concat(html0, head, html1!, attrs, html2!, app, html3!)
  return new Response(html, {
    status, headers: $html.init ??= {
      'content-security-policy': `default-src 'self';img-src * data: blob:;style-src 'self' 'unsafe-inline';`,
      server, [TYPE]: types.html
    }
  })
}
$html.init = null! as HeadersInit
const $redirect = (location: string, status = 302) => new Response(null, { status, headers: { server, location } })
export const $error = (status: number, name: string, title?: string) => {
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
    status, headers: { server, [TYPE]: `${types.html};charset=UTF-8` }
  })
}

let args: string[] | undefined
{
  let isBrowser = false
  switch (platform) {
    case 'win32': try {
      if (config.browsers == null || config.defaultBrowser == null) { throw null }
      const $args = getOwn(config.browsers, config.defaultBrowser)?.args
      if ($args == null) { throw null }
      const i = indexOf($args, '%1')
      if (!(i > 0)) { throw null }
      $args[i] = '$1'
      args = $args; isBrowser = true
    } catch (cause) {
      args = ['explorer', '$1']
      error(new TypeError('获取默认浏览器失败', { cause }))
    } break
  }
  if (isBrowser) { log('浏览器:', args![0]) }
}
export const open = (url: string) => new Promise<number | null | void>(ok => {
  if (args == null) { return ok() }
  const [command, ...$args] = args
  $args[indexOf($args, '$1')] = url
  const process = spawn(command!, $args, { stdio: 'inherit', shell: false })
  process.on('exit', ok)
})

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
        const nextPath = decodeURIComponent(slice(path, 1))
        return $redirect(`${base}${nextPath}`)
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
      case '/robots.txt':
        return $error(404, name)
    }
  }
  return $error(404, name)
}
const afterListen = async (server: typeof serverInst, localAddr: typeof localAddrPromise) => {
  let { hostname, port } = await localAddr
  if (hostname === '0.0.0.0') { hostname = '127.0.0.1' }
  origin = `http://${hostbase}localhost:${port}`
  url = `${origin}/`
  allowOrigin[origin] = null
  log(`Listening on ${url}`)
  return { server, hostname, port, url }
}
const onError = (e: any) => { error(e); return $error(500, name) }
export const main = (port = 6702, hostname = '127.0.0.1') => {
  if (serverInst != null) { throw null }
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
          const { address } = this.requestIP(request)!
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

if (typeof addEventListener == 'function') {
  for (const type of ['file', 'directory']) {
    addEventListener(`tray:open:${type}`, e => {
      if (url == null) { return }
      const nextPath = `.dialog?${new URLSearchParams({ type, path: (e as CustomEvent).detail })}`
      open(`${url}!${encodeURIComponent(nextPath)}`)
    })
  }
}

let url: string, origin: string
let serverInst: Deno.HttpServer<Deno.NetAddr> | Bun.Server<void>
let localAddrPromise: Promise<Deno.NetAddr | Bun.Server<void>>
