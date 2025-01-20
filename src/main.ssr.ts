
export const name = 'Metadata Fetcher'
export * from './bind'
export * from './plugin'
export { getCache, setCache } from './cache'
export { config, readConfig, writeConfig } from './config'
export { handleRequest as handleRequestBbdown } from './utils/bbdown'

import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { $string, $array, onlyFirst32, escapeText, escapeAttr, escapeAttrApos } from './bind'
import { config } from './config'
import App from './components/app.vue'
import type { Store } from './components/app.vue'
const { keys } = Object, { stringify } = JSON
const { join } = $array, { concat, slice, replaceAll } = $string

const meta = (name: string, content = 'content') => {
  return function* (record: Record<string, string | null | undefined>) {
    for (const key of keys(record)) {
      const value = record[key]
      if (value == null) { continue }
      yield `<meta ${name}="${escapeAttr(key)}" ${content}="${escapeAttr(value)}">\n`
    }
  }
}

const metaName = meta('name')
const metaItemprop = meta('itemprop')
const metaProperty = meta('property')

export const buildMeta = (parsed: Store['parsed']) => {
  if (parsed == null) { return `<title>${name}</title>\n` }
  let description = onlyFirst32(parsed.description)
  description = replaceAll(description, '\n', ' ' as any)
  return concat(
    `<title>${escapeText(parsed.title)} - ${name}</title>\n`,
    ...metaName({
      title: parsed.title,
      author: parsed.ownerName,
      description,
      keywords: parsed.keywords,
    }),
    ...metaItemprop({
      name: parsed.title,
      image: parsed.thumbnailUrl,
      description,
    }),
    ...metaProperty({
      'og:title': parsed.title,
      'og:type': 'website',
      'og:url': parsed.url,
      'og:image': parsed.thumbnailUrl,
      'og:description': description,
    }),
  )
}

export const renderToHtml = async (input: string, ids?: string[]) => {
  const store: Store = { input: input, resolved: null, data: null, parsed: null, output: '', config }
  if (input[0] === '.') {
    const args = join(ids!, ' ')
    store.input = `${slice(input, 1)} ${args}`
    store.resolved = { id: input, rawId: input, shortUrl: '', url: args }
  }
  const app = createSSRApp(App, { store })
  const context = {}
  const appHTML = await renderToString(app, context)
  const attrs = ` data-store='${escapeAttrApos(stringify(store, void 0, 2))}'`
  const head = buildMeta(store.parsed)
  return { head, attrs, app: appHTML, context }
}
