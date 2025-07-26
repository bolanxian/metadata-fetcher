
export const name = 'Metadata Fetcher'
export * from './bind'
export * from './meta-fetch/mod'
export { ready } from './init'
export { render, renderBatch } from './render'
export { bindCall, call, bind } from 'bind:core'
export { hasOwn, getOwn, encodeText, decodeText, test, match, replace, split, on, off } from 'bind:utils'
export { config, readConfig, writeConfig } from './config'
export { S, P, createBatchParams } from './components/app.vue'
export { handleRequest as handleRequestBbdown } from './utils/bbdown'
export { illustId, illustName } from './utils/illust-name'

import { type AppConfig, createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { keys } from 'bind:Object'
import { slice, startsWith, replaceAll } from 'bind:String'
import { join, onlyFirst32, escapeText, escapeAttr, escapeAttrApos } from './bind'
import { config } from './config'
import App, { Data, type Store } from './components/app.vue'
import { getOwn } from 'bind:utils'
const { stringify } = JSON

const errorHandler: AppConfig['errorHandler'] = (err, instance, info) => {
  reportError(err)
}

const meta = (name: string, content = 'content') => {
  return function* (record: Record<string, string | null | undefined>) {
    for (const key of keys(record)) {
      const value = record[key]
      if (value == null) { continue }
      yield `<meta ${name}="${escapeAttr(key)}" ${content}="${escapeAttr(value)}">`
    }
  }
}
const metaName = meta('name')
const metaItemprop = meta('itemprop')
const metaProperty = meta('property')
function* xbuildMeta({ mode, parsed, [Data]: data, config }: Store): Generator<string, void, unknown> {
  if (mode === 'default' && parsed != null) {
    let { description } = parsed
    if (description != null) {
      description = onlyFirst32(description)
      description = replaceAll(description, '\n', ' ')
    }
    yield `<title>${escapeText(parsed.title)} - ${name}</title>`
    yield* metaName({
      title: parsed.title,
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
    return
  }
  let title = name
  if (startsWith(mode, 'batch:') && parsed != null) {
    const type = slice(mode, 6)
    const batchName = getOwn(config.batch, type)?.name || type
    title = `批量模式[${escapeText(batchName)}]：${escapeText(parsed.title)}\u3000等 ${data!.batchLength} 项 - ${name}`
  }
  yield `<title>${title}</title>`
  yield* metaProperty({
    'og:type': 'website',
    'og:site_name': name,
  })
}

export const renderToHtml = async (mode: string, input: string) => {
  const store: Store = { mode, input, resolved: null, data: null, parsed: null, batchResolved: null, output: '', config }
  const app = createSSRApp(App, { store }), context = {}
  app.config.errorHandler = errorHandler
  const appHTML = await renderToString(app, context)
  const attrs = ` data-store='${escapeAttrApos(stringify(store, void 0, 2))}'`
  const head = join(xbuildMeta(store), '\n')
  return { head, attrs, app: appHTML, context }
}
