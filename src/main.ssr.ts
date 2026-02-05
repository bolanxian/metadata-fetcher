
export const name = 'Metadata Fetcher'
export { load as cheerioLoad } from 'cheerio'
export { bindCall, call, bind } from 'bind:core'
export { hasOwn, getOwn, encodeText, decodeText, test, match, replace, split, on, off } from 'bind:utils'
export * from './bind'
export * from './meta-fetch/mod'
export { ready } from './init'
export { render, renderBatch } from './render'
export { config, readConfig, writeConfig } from './config'
export { S, P, createBatchParams } from './components/app.vue'
export { handleRequest as handleRequestBbdown } from './utils/bbdown'
export { illustId, illustName } from './utils/illust-name'
export { default as checkVersion } from './utils/check-version.js?raw'

import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { slice, startsWith, replaceAll } from 'bind:String'
import { getOwn } from 'bind:utils'
import { join, onlyFirst32, escapeJson, escapeText, escapeAttr, escapeAttrApos } from './bind'
import metaName from 'meta:name'
import metaItemprop from 'meta:itemprop'
import metaProperty from 'meta:property'
import { config } from './config'
import App, { type Store, Data, createStore, createData, prefetchStore } from './components/app.vue'
const { stringify } = JSON

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

export const renderToHtml = async (mode: string, input: string): Promise<{
  status: number, head: string, attrs: string, app: string, context: {} | null
}> => {
  let status: number | undefined
  const store = createStore(mode, input)
  store[Data] = createData(store)
  if (store.input) {
    try { await prefetchStore(store) }
    catch (err) { status = 500; reportError(err) }
  }
  const attrs = ` data-store='${escapeAttrApos(stringify(store, void 0, 2))}'`
  const head = join(xbuildMeta(store), '\n')
  let html = '', context: {} | null = null
  if (config.ssr) {
    const app = createSSRApp(App, { store })
    app.config.errorHandler = (err, instance, info) => {
      status = 500; reportError(err)
    }
    html = await renderToString(app, context = {})
  }
  if (status == null) {
    if (mode === 'default') {
      if (input && store.parsed == null) { status = 404 }
    } else if (startsWith(mode, 'batch:')) {
      if (store.parsed == null) { status = 404 }
    }
    status ??= 200
  }
  return { status, head, attrs, app: html, context }
}
