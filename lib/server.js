
import { bindCall, $string, ready, readTemplate, writeTemplate, renderToHtml, resolve, xparse, render, redirect } from '../dist/main.ssr.js'
await ready

const { stringify } = JSON, { error } = console
const { startsWith, slice, includes, lastIndexOf, replaceAll } = $string
const bind = bindCall(Function.prototype.bind)
const encode = bind(TextEncoder.prototype.encode, new TextEncoder())

const template = await Deno.readTextFile('./dist/index.html')

const types = {
  __proto__: null,
  'css': 'text/css',
  'html': 'text/html',
  'js': 'text/javascript',
  'json': 'application/json',
  'woff2': 'font/woff2'
}
const assets = { __proto__: null }
for await (let { isFile, name } of Deno.readDir('./dist/.assets/')) {
  if (!isFile) { continue }
  const data = await Deno.readFile(`./dist/.assets/${name}`)
  let type = types[slice(name, lastIndexOf(name, '.') + 1)] ?? ''
  assets[`.assets/${name}`] = new Response(data, {
    headers: { 'content-type': type }
  })
}

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
    headers: { location: new URL(`./${id}`, base).href }
  })
}
async function* _json(input) {
  let status = 0
  try {
    const [, resolved, redirected, , parsedPromise] = xparse(input)
    yield encode(`{
  "resolved":${stringify(resolved ?? null)}`)
    status = 1
    yield encode(`,
  "redirected":${stringify((await redirected) ?? null)}`)
    const parsed = await parsedPromise
    yield encode(`,
  "parsed":${stringify(parsed ?? null)},
  "rended":${stringify(parsed != null ? render(parsed) : null)}
}`)
  } catch (e) {
    let prefix = '{'
    switch (status) {
      case 1: prefix = ','; break
    }
    error(e)
    yield encode(`${prefix}
  "error":${stringify(e.message ?? 'unknown error')}
}`)
  }
}
const $json = async (input) => {
  return new Response(ReadableStream.from(_json(input)), {
    headers: { 'content-type': types.json }
  })
}
const $html = async (input, ids) => {
  return new Response(await renderToHtml(template, input, ids), {
    headers: { 'content-type': types.html }
  })
}

export const open = Deno.build.os === 'windows' ? (url) => {
  return new Deno.Command('explorer', { args: [url] }).output()
} : () => { }

export const main = ({
  port = 6702, hostname = '0.0.0.0',
  base = '/metadata-fetcher/',
  open: _open = true,
  onListen
} = {}) => Deno.serve({
  port, hostname,
  onListen({ hostname, port }) {
    const url = `http://${hostname}:${port}${base}`
    console.log(`Listening on ${url}`)
    onListen?.(url)
    if (_open) { open(url) }
  }
}, (request) => {
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
          headers: { location: url.href }
        })
      }
      return $html(decodeURIComponent(path))
    }
  }
  return new Response('404', { status: 404 })
})

if (import.meta.main) { main() }
