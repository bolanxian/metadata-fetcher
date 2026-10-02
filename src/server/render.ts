
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { trim, concat, slice, replaceAll, startsWith } from 'bind:String'
import { assert, getOwn, split } from 'bind:utils'
import { join, onlyFirst32, escapeJson, escapeText, escapeAttr, escapeAttrApos } from '@/bind'
import metaName from 'meta:name'
import metaItemprop from 'meta:itemprop'
import metaProperty from 'meta:property'
import { config } from '@/config'
import App, { type Store, Data, createStore, createData, prefetchStore } from '@/components/app.vue'
import { name, server, CSP, CSP_VALUE, TYPE, types } from './core'
const { stringify } = JSON

let html0: string, html1: string, html2: string, html3: string
let renderInit: ResponseInit

const urlKeys = ['shortUrl', 'url', 'relatedUrl']
function* xbuildMeta({ mode, parsed, [Data]: data, config }: Store): Generator<string, void, unknown> {
  if (mode === 'default' && parsed != null) {
    let { description } = parsed
    if (description != null) {
      description = onlyFirst32(description)
      description = replaceAll(description, '\n', ' ')
    }
    yield `<title>${escapeText(parsed.title)} - ${name}</title>`
    yield `<meta \
name="title" content="${escapeAttr(parsed.title)}" \
data-content-escaped="${escapeJson(parsed.title)}">`
    yield* metaName({
      author: parsed.ownerName,
      description,
      keywords: parsed.keywords,
    })
    yield* metaItemprop({
      name: parsed.title,
      image: parsed.thumbnailUrl,
      description,
    })
    yield* metaProperty({
      'og:type': 'website',
      'og:site_name': name,
      'og:title': parsed.title,
      'og:url': parsed.url,
      'og:image': parsed.thumbnailUrl,
      'og:description': description,
    })
    for (const key of urlKeys) {
      const url = getOwn(parsed, key)
      if (url) { yield `<link rel="alternate" data-key="${key}" href="${escapeAttr(url)}">` }
    }
    return
  }
  let title = name
  if (startsWith(mode, 'batch:') && parsed != null) {
    const type = slice(mode, 6)
    const batchName = getOwn(config.batch, type)?.name || type
    const batchLength = data!.batchLength! > 1 ? `\u3000和另外 ${data!.batchLength! - 1} 项` : ''
    title = `批量模式[${escapeText(batchName)}]：${escapeText(parsed.title)}${batchLength} - ${name}`
  }
  yield `<title>${title}</title>`
  yield* metaProperty({
    'og:type': 'website',
    'og:site_name': name,
  })
}

export const initHtml = (rawHtml: string) => {
  const html = split(/<title>.*?<\/title>|(?=><!--#app-->)|<!--#app-->/, rawHtml)
  html[0] = `\
  ${trim(html[0]!)}
  
  <script defer src="./.check-version"></script>
  <link rel="icon" type="${types.svg}" href="./.favicon">
  <link rel="search" type="${types.osdx}" href="./.opensearch" title="${name}">
`
  assert?.<Record<0 | 1 | 2 | 3, string>>(html)
  void ([html0, html1, html2, html3] = html)
}

export const renderToHtml = async (mode: Store['mode'], input: string) => {
  let status: number | undefined
  input = trim(input)
  const store = createStore(mode, input)
  store[Data] = createData(store)
  if (store.input) {
    try { await prefetchStore(store) }
    catch (err) { status = 500; reportError(err) }
  }
  const attrs = ` data-store='${escapeAttrApos(stringify(store, void 0, 2))}'`
  const head = join(xbuildMeta(store), '\n')
  let rendered = ''
  if (config.ssr) {
    const app = createSSRApp(App, { store })
    const context = {}
    app.config.errorHandler = (err, instance, info) => {
      status = 500; reportError(err)
    }
    rendered = await renderToString(app, context)
  }
  if (status == null) {
    if (mode === 'default') {
      if (input && store.parsed == null) { status = 404 }
    } else if (startsWith(mode, 'batch:')) {
      if (store.parsed == null) { status = 404 }
    }
    status ??= 200
  }

  const html = concat(html0, head, html1, attrs, html2, rendered, html3)
  renderInit ??= {
    status, headers: { server, [CSP]: CSP_VALUE, [TYPE]: types.html }
  }
  renderInit.status = status
  return new Response(html, renderInit)
}
