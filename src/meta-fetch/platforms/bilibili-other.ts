
import * as cheerio from 'cheerio'
import { test } from 'bind:utils'
import { find } from 'bind:Array'
import { toHttps } from '@/bind'
import { defineDiscover } from '../discover'
import { definePlugin, redirectPlugin } from '../plugin'
import { $fetch, htmlInit } from '../fetch'
import { REG_INIT } from './bilibili-video'
import { fromHTML } from '@/utils/find-json-object'
import { instantToString } from '@/utils/temporal'
export const REG_CV = /^cv((?!0\d)\d+)$/
export const REG_OPUS = /^bili!opus!(\d{18,})$/

defineDiscover({
  name: 'Bilibili article',
  discover: [REG_CV, /^@cv(\d+)$/],
  discoverHttp: [
    /^www\.bilibili\.com\/(?:read\/cv|mobile\?id=)(\d+)/
  ],
  handle: m => `bilibili/article/cv${m[1]}`
})
defineDiscover({
  name: 'Bilibili opus',
  discover: [REG_OPUS],
  discoverHttp: [
    /^(?:m\.|www\.)?bilibili\.com\/opus\/(\d{18,})/,
    /^t\.bilibili\.com\/(\d{18,})/
  ],
  handle: m => `bilibili/opus/${m[1]}`
})

definePlugin({
  name: 'Bilibili article',
  path: 'bilibili/article',
  resolve(path) {
    if (path.length !== 1) { return }
    const id: string = path[0]!
    if (!test(REG_CV, id)) { return }
    return {
      id: `@${id}`, displayId: id, cacheId: id,
      shortUrl: '', url: `https://www.bilibili.com/read/${id}/`
    }
  },
  ...redirectPlugin
})
definePlugin({
  name: 'Bilibili opus',
  path: 'bilibili/opus',
  resolve(path) {
    if (path.length !== 1) { return }
    const oid = path[0]
    const id = `bili!opus!${oid}`
    if (!test(REG_OPUS, id)) { return }
    return {
      id, displayId: id, cacheId: id, shortUrl: '',
      url: `https://www.bilibili.com/opus/${oid}`
    }
  },
  async fetch(cache, { id, url }) {
    return await cache.json(id, async () => {
      let text = await cache.get(`${id}.html`)
      if (text == null) {
        const resp = await $fetch(url, htmlInit)
        const { status } = resp
        if (status !== 200) {
          throw new TypeError(`Request failed with status code ${status}`)
        }
        text = await resp.text()
      }
      const $ = cheerio.load(text, { baseURI: url })
      const data = fromHTML($, REG_INIT)
      return data.detail
    })
  },
  parse(detail, info) {
    let relatedUrl = detail.type === 1
      ? `https://www.bilibili.com/read/cv${detail.basic.rid_str}`
      : `https://t.bilibili.com/${detail.id_str}`
    let content = '', thumb: string | undefined
    const title = find(detail.modules, m => m.module_type === 'MODULE_TYPE_TITLE')?.module_title.text ?? ''
    const author = find(detail.modules, m => m.module_type === 'MODULE_TYPE_AUTHOR').module_author
    const { paragraphs } = find(detail.modules, m => m.module_type === 'MODULE_TYPE_CONTENT').module_content
    for (const p of paragraphs) {
      switch (p.para_type) {
        case 1: for (const node of p.text.nodes) {
          switch (node.type) {
            case 'TEXT_NODE_TYPE_WORD':
              content += `${node.word.words}`
              break
          }
        } break
        case 2: for (const pic of p.pic.pics) {
          const url = toHttps(pic.url)
          content += `${url}\n`
          thumb ??= url
        } break
      }
      content += '\n'
    }
    return {
      title,
      ownerName: author.name,
      ownerUrl: author.mid,
      relatedUrl,
      thumbnailUrl: thumb,
      publishDate: instantToString(author.pub_ts * 1000),
      description: content
    }
  }
})