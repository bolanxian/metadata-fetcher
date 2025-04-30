
/// <reference types="deno" />
/// <reference types="bun" />
const base = '/metadata-fetcher/'
import { platform } from 'node:process'
import { spawn } from 'node:child_process'
import { opendir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { STATUS_CODES } from 'node:http'
import {
  name, $string, $array, match, split, encodeText as encode,
  handleRequestBbdown,
  ready, getOwn, getCache, config, readConfig, writeConfig,
  renderToHtml, resolve, xparse, render, redirect
} from '../dist/main.ssr.js'
import { getCpu, getCpuUsage, getMemoryUsage, getOs, getRuntime, getPm } from './info.js'
await ready

const { parse, stringify } = JSON, { log, error } = console
const { trim, concat, startsWith, slice, includes, lastIndexOf, replaceAll } = $string
const { indexOf } = $array

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

<link rel="icon" href="./.favicon">
`
const [html0, html1, html2, html3] = _html
const server = navigator.userAgent
const $ = { __proto__: null }
let url, origin, serverInst

const defineStaticFile = (name, type, data) => {
  const resp = new Response(data, {
    headers: {
      server,
      'content-type': type,
      'cache-control': 'public, max-age=86400'
    }
  })
  $[name] = (ctx) => resp.clone()
}
const types = {
  __proto__: null,
  'css': 'text/css',
  'html': 'text/html',
  'js': 'text/javascript',
  'json': 'application/json',
  'txt': 'text/plain',
  'woff2': 'font/woff2'
}
for await (let dirent of await opendir('./dist/.assets/')) {
  if (!dirent.isFile()) { continue }
  const { name } = dirent
  const data = await readFile(`./dist/.assets/${name}`)
  const type = types[slice(name, lastIndexOf(name, '.') + 1)] ?? ''
  defineStaticFile(`assets/${name}`, type, data)
}
defineStaticFile('favicon', 'image/svg+xml', `\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -59 100 100">\
<text font-size="90" text-anchor="middle" dominant-baseline="middle">\
🔨\
</text>\
</svg>\
`)

const REG_ID = /(?<![a-z])[a-z]{2}\d+/g
const matcher = (getIter) => async (ctx) => {
  const set = new Set()
  for await (const data of getIter(ctx, set)) {
    for (let id of match(REG_ID, data) ?? []) {
      id = resolve(id)?.id
      if (id != null) { set.add(id) }
    }
  }
  const searchParams = new URLSearchParams()
  for (const id of set) {
    searchParams.append('id', id)
  }
  return new Response(null, {
    status: 302,
    headers: { server, location: new URL(`./.list?${searchParams}`, ctx.url).href }
  })
}
$.file = matcher(({ url }) => [
  readFile(url.searchParams.get('.'), { encoding: 'utf-8' })
])
$.directory = matcher(async function* ({ url }, set) {
  let i = 0
  for await (let dirent of await opendir(url.searchParams.get('.'))) {
    yield dirent.name
    if (128 < i++) {
      set.add('@truncate')
      break
    }
  }
})
$.bbdown = ({ request }) => {
  if (request.headers.get('upgrade') !== 'websocket') {
    return $error(426, name)
  }
  $.bbdown.cwd ??= fileURLToPath(import.meta.resolve('../__download__/'))
  return handleRequestBbdown(request, $.bbdown.cwd) ?? $error(400, name)
}
$.info = ({ remoteAddr }) => new Response(stringify({
  remoteAddr, cpu: getCpu(), cpuUsage: getCpuUsage(),
  memoryUsage: getMemoryUsage(),
  os: getOs(), runtime: getRuntime(), pm: getPm()
}), $.info.init ??= {
  headers: { server, 'content-type': types.json }
})
$.config = async ({ request, remoteAddr }) => {
  if (request.method === 'POST') {
    if (!startsWith(remoteAddr, '127.') || origin !== request.headers.get('origin')) {
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
$.redirect = async ({ url }) => {
  const input = url.searchParams.get('url') ?? ''
  let target = await redirect(input)
  target = target != null ? resolve(target)?.id ?? target : null
  let id = encodeURIComponent(target ?? input)
  return new Response(null, {
    status: 302,
    headers: { server, location: new URL(`./${id}`, url).href }
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
$.id = ({ 0: input, url }) => {
  const location = new URL(`./.batch?${new URLSearchParams([
    ['from', 'legacy'],
    ['type', input],
    ...url.searchParams
  ])}`, url).href
  return new Response(null, {
    status: 302,
    headers: { server, location }
  })
}
$.list = $.name = $.escape = ({ 0: input, url }) => {
  const location = new URL(`./.batch?${new URLSearchParams([
    ['from', 'legacy'],
    ['type', slice(input, 1)],
    ...url.searchParams
  ])}`, url).href
  return new Response(null, {
    status: 302,
    headers: { server, location }
  })
}
$.batch = ({ url }) => {
  const params = url.searchParams
  const input = params.get('type')
  const ids = params.getAll('id')
  return $html(`.${input}`, ids)
}
const $html = async (input, ids) => {
  let { head, attrs, app } = await renderToHtml(input, ids)
  head ??= `<title>${name}</title>`
  const html = concat(html0, head, html1, attrs, html2, app, html3)
  return new Response(html, $html.init ??= {
    headers: { server, 'content-type': types.html }
  })
}
const $error = (status, name) => {
  const title = `${status} ${STATUS_CODES[status] ?? 'Unknown'}`
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
    status,
    headers: { server, 'content-type': types.html }
  })
}

export const open = await (async () => {
  let isBrowser = false
  let command, $args, i
  switch (platform) {
    case 'win32': try {
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
  const { pathname } = url
  if (startsWith(pathname, base)) {
    const path = slice(pathname, base.length)
    switch (path[0]) {
      case '.': {
        const fn = $[slice(path, 1)]
        if (fn != null) {
          return fn({
            request, remoteAddr, url, 0: path
          })
        }
      } break
      case '!': {
        const location = new URL(decodeURIComponent(slice(path, 1)), url).href
        return new Response(null, {
          status: 302,
          headers: { server, location }
        })
      }
      default: {
        if (includes(path, '/')) {
          url.pathname = `${base}${replaceAll(path, '/', '%2F')}`
          return new Response(null, {
            status: 302,
            headers: { server, location: url.href }
          })
        }
        return $html(decodeURIComponent(path))
      }
    }
  } else {
    let location
    switch (pathname) {
      case '/':
        url.pathname = base
        location = url.href
        break
      case '/favicon.ico':
        url.pathname = `${base}.favicon`
        location = url.href
        break
    }
    if (location != null) {
      return new Response(null, {
        status: 302,
        headers: { server, location }
      })
    }
  }
  return $error(404, name)
}
const onListen = ({ hostname, port }, { open: _open, handleListen }) => {
  if (hostname === '0.0.0.0') { hostname = '127.0.0.1' }
  origin = `http://${hostname}:${port}`
  url = `${origin}${base}`
  log(`Listening on ${url}`)
  handleListen?.(url)
  if (_open) { open(url) }
}
const onError = (e) => { error(e); return $error(500, name) }
export const main = ({
  port = 6702, hostname = '0.0.0.0',
  open = true,
  onListen: handleListen
} = {}) => {
  if (serverInst != null) { (void 0)() }
  switch (runtime) {
    case 'deno': serverInst = Deno.serve({
      port, hostname,
      onListen(localAddr) {
        onListen(localAddr, { open, handleListen })
      },
      handler(request, { remoteAddr: { hostname } }) {
        return fetch(request, hostname)
      },
      onError
    })
      break
    case 'bun': serverInst = Bun.serve({
      port, hostname,
      idleTimeout: 45,
      fetch(request) {
        const { address } = this.requestIP(request)
        return fetch(request, address)
      },
      error: onError
    })
      setTimeout(() => { onListen(serverInst, { open, handleListen }) }, 0)
      break
  }
  return serverInst
}

for (const type of ['file', 'directory']) {
  addEventListener(`tray:open:${type}`, e => {
    if (url == null) { return }
    const uri = `./.${type}?${new URLSearchParams({ '.': e.detail })}`
    open(`${url}!${encodeURIComponent(uri)}`)
  })
}

export default { fetch }
