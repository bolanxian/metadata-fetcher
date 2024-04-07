
import { bindCall, $string, readTemplate, writeTemplate, renderToHtml } from './dist/main.ssr.js'

const { startsWith, slice, lastIndexOf, replaceAll } = $string
const bind = bindCall(Function.prototype.bind)
const encode = bind(TextEncoder.prototype.encode, new TextEncoder())

const template = await Deno.readTextFile('./dist/index.html')
const [html0, html1, html2] = template.split('<!--#app-->').map(html => encode(html))
const ssrManifest = await Deno.readTextFile('./dist/manifest.ssr.json').then(null, e => null)

const types = {
  __proto__: null,
  'css': 'text/css',
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

async function* genHtml({ store, stream }) {
  yield html0
  yield* stream
  yield html1
  yield encode(replaceAll(JSON.stringify(store), '</script>', '<\\/script>'))
  yield html2
}

export const main = (port = 6702, hostname = '0.0.0.0', base = '/metadata-fetcher/') => Deno.serve({
  port, hostname,
  onListen({ hostname, port }) {
    const url = `http://${hostname}:${port}${base}`
    console.log(`Listening on ${url}`)
    if (Deno.build.os === 'windows') {
      new Deno.Command('explorer', { args: [url] }).output()
    }
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
        case '.template':
          if (request.method === 'POST') {
            return request.text().then(text => writeTemplate(text)).then(_ => {
              return new Response('success')
            })
          }
          return readTemplate().then(text => {
            return new Response(text)
          })
        case '.id': case '.list': case '.name': {
          const gen = genHtml(renderToHtml(path, url.searchParams.getAll('id')))
          return new Response(ReadableStream.from(gen), {
            headers: { 'content-type': 'text/html' }
          })
        }
      }
    } else {
      const gen = genHtml(renderToHtml(decodeURIComponent(path)))
      return new Response(ReadableStream.from(gen), {
        headers: { 'content-type': 'text/html' }
      })
    }
  }
  return new Response('404', { status: 404 })
})

if (import.meta.main) { main() }
