
import * as cheerio from 'cheerio'
import { test } from 'bind:utils'
import { trim } from 'bind:String'
import { from, reverse, join } from 'bind:Array'
import { htmlToText } from '@/bind'
import { $fetch, htmlInit } from '../fetch'
import { defineDiscover } from '../discover'
import { definePlugin } from '../plugin'
const REG_LRC = /^(?:utatime|lyrical-nonsense)[!:]([-\w]+)[!/]([-\w]+)$/

defineDiscover({
  name: 'UtaTime',
  discover: [REG_LRC],
  discoverHttp: [
    /^(?:www\.)?(?:utatime|lyrical-nonsense)\.com\/(?:global\/)?lyrics\/([-\w]+)\/([-\w]+)\//
  ],
  handle: m => `utatime/lyrics/${m[1]}/${m[2]}`
})
definePlugin({
  name: 'UtaTime',
  path: 'utatime/lyrics',
  resolve(path) {
    if (path.length !== 2) { return }
    const id = `utatime!${path[0]}!${path[1]}`
    if (!test(REG_LRC, id)) { return }
    const displayId = `utatime:${path[0]}/${path[1]}`
    const cacheId = `lyrical-nonsense!${path[0]}!${path[1]}`
    const url = `https://www.utatime.com/global/lyrics/${path[0]}/${path[1]}/`
    return { id, displayId, cacheId, shortUrl: '', url }
  },
  async fetch(cache, { cacheId, url }) {
    const text = await cache.tryGet(`${cacheId}.html`, async () => {
      const resp = await $fetch(url, htmlInit)
      const { status } = resp
      if (status !== 200) {
        throw new TypeError(`Request failed with status code ${status}`)
      }
      return await resp.text()
    })
    if (text == null) { return }
    const $ = cheerio.load(text, { baseURI: url })
    return { $ }
  },
  parse({ $ }, info) {
    let desc = ''
    for (const el of reverse(from($('.olyrictext')))) {
      let text = join(from($('.line-text', el), line => $(line).text()), '\n')
      if (!text) { text = trim(htmlToText(trim($(el).html()!))) }
      desc += `${text}\n\n`
    }
    return {
      title: $('.site-header .pageheader').text(),
      thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? '',
      description: desc
    }
  }
})
