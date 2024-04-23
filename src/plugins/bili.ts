
import { $string, test, dateToLocale } from '../bind'
import { definePlugin, html } from '../plugin'
import * as BV from '../utils/bv-encode'
import { fromHTML } from '../utils/find-json-object'
const { slice, indexOf } = $string
const RE_INIT = /^window\.__INITIAL_STATE__\s*=\s*(?={)/

const toShortUrl = (id: string) => `https://b23.tv/${id}`
const toUrl = (id: string) => `https://www.bilibili.com/video/${id}/`

export const main = definePlugin({
  include: [
    BV.REG_AV, BV.REG_BV,
    /^(?:https?:\/\/)?b23\.tv\/(\w+)/,
    /^(?:https?:\/\/)?(?:m|www)\.bilibili\.com\/video\/(\w+)/
  ],
  resolve(m) {
    let id = m[1]
    if (test(BV.REG_AV, id)) {
      id = `av${slice(id, 2)}`
    } else if (test(BV.REG_BV, id)) {
      id = BV.decode(id) ?? `BV1${slice(id, 3)}`
    } else {
      return null
    }
    return { id, rawId: id, shortUrl: toShortUrl(id), url: toUrl(id) }
  },
  async parse(info) {
    let { rawId: id, shortUrl, url } = info
    const { $ } = await html(info)
    const _ = fromHTML($, RE_INIT)
    const { videoData } = _
    const { aid } = videoData
    if (aid != null) {
      id = `av${aid}`
      shortUrl = toShortUrl(id)
      url = toUrl(id)
    }
    let thumb = $('meta[property="og:image"]').attr('content') ?? '', index = 0
    if ((index = indexOf(thumb, '@')) >= 0) {
      thumb = slice(thumb, 0, index)
    }
    thumb = thumb ? new URL(thumb, url).href : ''
    return {
      title: videoData.title,
      ownerName: videoData.owner.name,
      publishDate: dateToLocale(videoData.pubdate * 1000),
      shortUrl, url, thumbnailUrl: thumb,
      description: videoData.desc,
      _
    }
  }
})

definePlugin({
  include: [
    /^bv!([aA][vV](?!0(?!$))\d+)$/,
    /^raw!([bB][vV]1\w{9})$/
  ],
  resolve(m) {
    let i = indexOf(m[0], '!')
    let type = i > 0 ? slice(m[0], 0, i) : null
    let rawId, id
    switch (type) {
      case 'bv': {
        rawId = BV.encode(m[1])
        if (rawId != null) {
          id = `raw!${rawId}`
        } else {
          id = rawId = `av${slice(m[1], 2)}`
        }
      } break
      case 'raw': {
        rawId = `BV1${slice(m[1], 3)}`
        id = `raw!${rawId}`
      } break
      default: return null
    }
    return { id, rawId, shortUrl: toShortUrl(rawId), url: toUrl(rawId) }
  },
  parse: main.parse
})

definePlugin({
  include: [
    /^(cv\d+)/,
    /^(?:https?:\/\/)?www\.bilibili\.com\/read\/(cv\d+)/
  ],
  resolve({ 1: id }) {
    return { id, rawId: id, shortUrl: '', url: `https://www.bilibili.com/read/${id}/` }
  },
  async parse(info) {
    let { shortUrl, url } = info
    const { $ } = await html(info)
    const _ = fromHTML($, RE_INIT)
    const { readInfo } = _
    return {
      title: readInfo.title,
      ownerName: readInfo.author.name,
      publishDate: dateToLocale(readInfo.publish_time * 1000),
      shortUrl, url,
      thumbnailUrl: readInfo.banner_url,
      description: readInfo.summary,
      _
    }
  }
})
