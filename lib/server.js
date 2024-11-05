
/// <reference types="deno" />
/// <reference types="bun" />
const base = '/metadata-fetcher/'
import { platform } from 'node:os'
import { opendir, readFile } from 'node:fs/promises'
import { STATUS_CODES } from 'node:http'
import {
  name, bindCall, $string, ready, readTemplate, writeTemplate,
  renderToHtml, resolve, xparse, render, redirect
} from '../dist/main.ssr.js'
import { getCpu, getCpuUsage, getMemoryUsage, getOs, getRuntime, getPm } from './info.js'
await ready

const { stringify } = JSON, { log, error } = console
const { startsWith, slice, includes, lastIndexOf, replaceAll } = $string
const bind = bindCall(Function.prototype.bind)
const encode = bind(TextEncoder.prototype.encode, new TextEncoder())

const template = await readFile('./dist/index.html', { encoding: 'utf8' })

const types = {
  __proto__: null,
  'css': 'text/css',
  'html': 'text/html',
  'js': 'text/javascript',
  'json': 'application/json',
  'woff2': 'font/woff2'
}
const assets = { __proto__: null }
const server = navigator.userAgent
for await (let dirent of await opendir('./dist/.assets/')) {
  if (!dirent.isFile()) { continue }
  const { name } = dirent
  const data = await readFile(`./dist/.assets/${name}`)
  const type = types[slice(name, lastIndexOf(name, '.') + 1)] ?? ''
  assets[`.assets/${name}`] = new Response(data, {
    headers: {
      server,
      'content-type': type,
      'cache-control': 'public, max-age=86400'
    }
  })
}

const $info = (request, remote) => new Response(stringify({
  remote, cpu: getCpu(), cpuUsage: getCpuUsage(),
  memoryUsage: getMemoryUsage(),
  os: getOs(), runtime: getRuntime(), pm: getPm()
}), $info.init ??= {
  headers: { server, 'content-type': types.json }
})
const $template = async (request) => {
  if (request.method === 'POST') {
    const text = await request.text()
    await writeTemplate(text)
    return new Response('success')
  }
  const text = await readTemplate()
  return new Response(text)
}
const $redirect = async (input, base) => {
  let target = await redirect(input)
  target = target != null ? resolve(target)?.id ?? target : null
  let id = encodeURIComponent(target ?? input)
  return new Response(null, {
    status: 302,
    headers: { server, location: new URL(`./${id}`, base).href }
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
const $json = async (input) => {
  return new Response(ReadableStream.from(_json(input)), $json.init ??= {
    headers: { server, 'content-type': types.json }
  })
}
const $html = async (input, ids) => {
  return new Response(await renderToHtml(template, input, ids), $html.init ??= {
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

export let open = (url) => {
  switch (`${platform()}:${typeof Deno}:${typeof Bun}`) {
    case 'win32:object:undefined':
      return (open = async (url) => {
        return (await new Deno.Command('explorer', { args: [url] }).output()).code
      })(url)
    case 'win32:undefined:object':
      return (open = (url) => {
        return Bun.spawn(['explorer', url]).exited
      })(url)
  }
  return (open = () => { })()
}

const fetch = (request, remoteAddr) => {
  const url = new URL(request.url)
  const { pathname } = url
  if (startsWith(pathname, base)) {
    const path = slice(pathname, base.length)
    if (path[0] === '.') {
      if (startsWith(path, '.assets/')) {
        const asset = assets[path]
        if (asset != null) {
          return asset.clone()
        }
      } else switch (path) {
        case '.info': return $info(request, remoteAddr)
        case '.template': return $template(request)
        case '.redirect': return $redirect(url.searchParams.get('url') ?? '', url)
        case '.json': return $json(url.searchParams.get('.') ?? '')
        case '.id': case '.list': case '.name': case '.escape': {
          return $html(path, url.searchParams.getAll('id'))
        }
      }
    } else {
      if (includes(path, '/')) {
        url.pathname = `${base}${replaceAll(path, '/', '%2F')}`
        return new Response(null, {
          status: 302,
          headers: { server, location: url.href }
        })
      }
      return $html(decodeURIComponent(path))
    }
  } else if (pathname === '/') {
    url.pathname = base
    return new Response(null, {
      status: 302,
      headers: { server, location: url.href }
    })
  }
  return $error(404, name)
}
const onListen = ({ hostname, port }, { open: _open, handleListen }) => {
  if (hostname === '0.0.0.0') { hostname = '127.0.0.1' }
  const url = `http://${hostname}:${port}${base}`
  if (_open) {
    log(`Listening on ${url}`)
    open(url)
  }
  handleListen?.(url)
}
const onError = (e) => { error(e); return $error(500, name) }
export const main = ({
  port = 6702, hostname = '0.0.0.0',
  open = true,
  onListen: handleListen
} = {}) => {
  let server
  switch (`${typeof Deno}:${typeof Bun}`) {
    case 'object:undefined': server = Deno.serve({
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
    case 'undefined:object': server = Bun.serve({
      port, hostname,
      idleTimeout: 45,
      fetch(request) {
        const { address } = this.requestIP(request)
        return fetch(request, address)
      },
      error: onError
    })
      setTimeout(() => { onListen(server, { open, handleListen }) }, 0)
      break
  }
  return server
}

export default { fetch }
