
import * as cheerio from 'cheerio'
import { test } from 'bind:utils'
import { trim } from 'bind:String'
import { from, reverse, join } from 'bind:Array'
import { htmlToText } from '@/bind'
import { cache } from '../cache'
import { $fetch, htmlInit } from '../fetch'
import { defineDiscover } from '../discover'
import { definePlugin } from '../plugin'
const REG_LRC = /^lyrical-nonsense[!:]([-\w]+)[!/]([-\w]+)$/

defineDiscover({
  name: '歌詞リリ',
  discover: [REG_LRC],
  discoverHttp: [
    /^www\.lyrical-nonsense\.com\/(?:global\/)?lyrics\/([-\w]+)\/([-\w]+)\//
  ],
  handle: m => `lyrical-nonsense/lyrics/${m[1]}/${m[2]}`
})
definePlugin({
  name: '歌詞リリ',
  path: 'lyrical-nonsense/lyrics',
  resolve(path) {
    if (path.length !== 2) { return }
    const id = `lyrical-nonsense!${path[0]}!${path[1]}`
    if (!test(REG_LRC, id)) { return }
    const displayId = `lyrical-nonsense:${path[0]}/${path[1]}`
    const url = `https://www.lyrical-nonsense.com/global/lyrics/${path[0]}/${path[1]}/`
    return { id, displayId, cacheId: id, shortUrl: '', url }
  },
  async fetch(info) {
    const text = await cache.tryGet(`${info.id}.html`, async () => {
      const resp = await $fetch(info.url, htmlInit)
      const { status } = resp
      if (status !== 200) {
        throw new TypeError(`Request failed with status code ${status}`)
      }
      return await resp.text()
    })
    if (text == null) { return }
    const $ = cheerio.load(text, { baseURI: info.url })
    return { $ }
  },
  parse(data, info) {
    const { $ } = data, { url } = info
    let desc = ''
    for (const el of reverse(from($('.olyrictext')))) {
      let text = join(from($('.line-text', el), line => $(line).text()), '\n')
      if (!text) { text = trim(htmlToText(trim($(el).html()!))) }
      desc += `\n${text}\n`
    }
    return {
      title: $('input[type="hidden"][name="pagetitle"]').attr('value') ?? '',
      ownerName: '',
      publishDate: $('meta[property="article:modified_time"]').attr('content') ?? '',
      shortUrl: url, url,
      thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? '',
      description: desc
    }
  }
})
