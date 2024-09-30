
export const name = 'Metadata Fetcher'

import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import * as cheerio from 'cheerio'
import { $string, $array, replace } from './bind'
import { template } from './plugin'
import App from './components/app.vue'
import type { Store } from './components/app.vue'
const { keys } = Object
const { join } = $array, { slice, replaceAll } = $string

export { bindCall, $string, $array } from './bind'
export {
  resolve, parse, xparse,
  render, renderIds, renderList,
  renderListDefaultRender, renderListNameRender, renderListEscapeRender,
  getSeparator, readTemplate, writeTemplate, ready,
  redirect, html, json
} from './plugin'

type Creater = ($: cheerio.CheerioAPI, record: Record<string, string | null | undefined>) => Generator<cheerio.Cheerio<cheerio.AnyNode>, void, unknown>
const createCreater = (name: string, content = 'content'): Creater => {
  return function* ($, record) {
    for (const key of keys(record)) {
      const value = record[key]
      if (value == null) { continue }
      yield $('<meta>').attr(name, key).attr(content, value)
    }
  }
}

const createMetaName = createCreater('name')
const createMetaItemprop = createCreater('itemprop')
const createMetaProperty = createCreater('property')

export const renderToHtml = async (html: string, input: string, ids?: string[]) => {
  const store: Store = { input: input, resolved: null, data: null, parsed: null, output: '', template }
  if (input[0] === '.') {
    const args = join(ids!, ' ')
    store.input = `${slice(input, 1)} ${args}`
    store.resolved = { id: input, rawId: input, shortUrl: '', url: args }
  }
  const app = createSSRApp(App, { store })
  const context = {}
  const appHTML = await renderToString(app, context)

  const $ = cheerio.load(html)
  const $title = $('title')
  if (store.parsed != null) {
    const { parsed } = store
    let description = replace(/(?<=^.{32}).+$/su, parsed.description, '...' as any)
    description = replaceAll(description, '\n', ' ' as any)
    $title.text(`${parsed.title} - ${name}`)
    $title.after(
      '\n<!--[-->',
      ...createMetaName($, {
        title: parsed.title,
        author: parsed.ownerName,
        description,
        keywords: parsed.keywords
      }),
      ...createMetaItemprop($, {
        name: parsed.title,
        description,
        image: parsed.thumbnailUrl,
      }),
      ...createMetaProperty($, {
        'og:title': parsed.title,
        'og:type': 'website',
        'og:url': parsed.url,
        'og:image': parsed.thumbnailUrl,
        'og:description': description
      }),
      '<!--]-->'
    )
  }
  $('#store').text(replaceAll(JSON.stringify(store), '</script>', '<\\/script>' as any))
  return replaceAll($.html(), '<!--#app-->', appHTML as any)
}
