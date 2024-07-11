
export const name = 'Metadata Fetcher'

import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import * as cheerio from 'cheerio'
import { $string, $array } from './bind'
import { template } from './plugin'
import App from './components/app.vue'
import type { Store } from './components/app.vue'
const { keys } = Object
const { join } = $array, { slice, replaceAll } = $string

export { bindCall, $string, $array } from './bind'
export {
  resolve, parse, xparse,
  render, renderIds, renderList,
  renderListDefaultRender, renderListNameRender,
  getSeparator, readTemplate, writeTemplate, ready
} from './plugin'

const $ = cheerio.load('<container><title></title></container>', null, false)
const _ = $(':root'), $meta = $('<meta>'), $title = $('title')
const createInjecter = (node: cheerio.Cheerio<cheerio.AnyNode>, name: string, content = 'content') => {
  return (record: Record<string, string | null | undefined>) => {
    for (const key of keys(record)) {
      const value = record[key]
      if (value == null) { continue }
      _.append(node.clone().attr(name, key).attr(content, value))
    }
  }
}
const injectMetaName = createInjecter($meta, 'name')
const injectMetaProperty = createInjecter($meta, 'property')

export const renderToHtml = async (input: string, ids?: string[]) => {
  const store: Store = { input: input, resolved: null, parsed: null, output: '', template }
  if (input[0] === '.') {
    const args = join(ids!, ' ')
    store.input = `${slice(input, 1)} ${args}`
    store.resolved = { id: input, rawId: input, shortUrl: '', url: args }
  }
  const app = createSSRApp(App, { store })
  const context = {}
  const appHTML = await renderToString(app, context)

  if (store.parsed != null) {
    const { parsed } = store
    const description = replaceAll(slice(parsed.description, 0, 32), '\n', ' ' as any)
    $title.text(`${parsed.title} - ${name}`)
    injectMetaName({
      author: parsed.ownerName,
      description,
      keywords: parsed.keywords
    })
    injectMetaProperty({
      'og:title': parsed.title,
      'og:type': 'website',
      'og:url': parsed.url,
      'og:image': parsed.thumbnailUrl,
      'og:description': description
    })
  } else {
    $title.text(name)
  }
  const head = _.html()
  $('meta').remove()

  return { head, app: appHTML, store, context }
}
