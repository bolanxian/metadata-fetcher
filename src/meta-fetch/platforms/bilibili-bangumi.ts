
import * as cheerio from 'cheerio'
import { test } from 'bind:utils'
import { fromHTML } from '@/utils/find-json-object'
import { $fetch, htmlInit } from '../fetch'
import { defineDiscover } from '../discover'
import { definePlugin, redirectPlugin } from '../plugin'
import { REG_BGM, toShortUrl } from './bilibili-video'

export const REG_BGM_FULL = /^bilibili-bangumi!((?:ep|ss)\d+)$/
export const toUrl = (id: string) => `https://www.bilibili.com/bangumi/play/${id}`

defineDiscover({
  name: 'Bilibili Bangumi',
  discover: [REG_BGM_FULL],
  discoverHttp: [
    /^www\.bilibili\.com\/bangumi\/play\/((?:ep|ss)(?!0\d)\d+)/
  ],
  handle: m => `bilibili/bangumi/${m[1]}`
})
definePlugin({
  name: 'Bilibili Bangumi',
  path: 'bilibili/bangumi',
  resolve(path) {
    if (path.length !== 1) { return }
    const shortId: string = path[0]!
    if (!test(REG_BGM, shortId)) { return }
    const id = `bilibili-bangumi!${shortId}`
    return {
      id, displayId: id, cacheId: id,
      shortUrl: toShortUrl(shortId), url: toUrl(shortId)
    }
  },
  async redirect({ url }) {
    const resp = await $fetch(url, htmlInit)
    const { status } = resp
    if (status !== 200) {
      throw new TypeError(`Request failed with status code ${status}`)
    }
    const text = await resp.text()
    const $ = cheerio.load(text, { baseURI: url })
    const data = fromHTML($, /^\s*\w+\s+playurlSSRData\s*=\s*(?={)/)
    return data?.data.result.arc.bvid
  },
  ...redirectPlugin
})
