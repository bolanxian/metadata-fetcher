
import { readTemplate, writeTemplate, renderToHtml } from './dist/main.ssr.js'

const port = 6702, base = '/metadata-fetcher/'

const { apply } = Reflect
const { bind: _bind, call: _call } = Function.prototype
const bindCall = apply(_bind, _bind, [_call])
const bind = bindCall(_bind)
const encode = bind(TextEncoder.prototype.encode, new TextEncoder())

const template = await Deno.readTextFile('./dist/index.html')
const [html0, html1, html2] = template.split('<!--#app-->').map(html => encode(html))
const ssrManifest = Deno.readTextFile('./dist/manifest.ssr.json').then(null, e => null)

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
  name = String(name)
  const data = await Deno.readFile(`./dist/.assets/${name}`)
  let type = types[name.slice(name.lastIndexOf('.') + 1)] ?? ''
  assets[`.assets/${name}`] = new Response(data, {
    headers: { 'content-type': type }
  })
}

async function* genHtml({ store, stream }) {
  yield html0
  yield* stream
  yield html1
  yield encode(JSON.stringify(store).replaceAll('</script>', '<\\/script>'))
  yield html2
}

Deno.serve({
  port,
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
  if (pathname.startsWith(base)) {
    const path = pathname.slice(base.length)
    if (path[0] === '.') {
      if (path.startsWith('.assets/')) {
        const asset = assets[path]
        if (asset != null) {
          return asset.clone()
        }
      } else if (path === '.template') {
        if (request.method === 'POST') {
          return request.text().then(text => writeTemplate(text)).then(_ => {
            return new Response('success')
          })
        }
        return readTemplate().then(text => {
          return new Response(text)
        })
      }
    } else {
      const gen = genHtml(renderToHtml(path, ssrManifest))
      return new Response(ReadableStream.from(gen), {
        headers: { 'content-type': 'text/html' }
      })
    }
  }
  return new Response('404', { status: 404 })
})
