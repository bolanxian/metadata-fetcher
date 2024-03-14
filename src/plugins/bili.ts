
import { $string, test, match } from '../bind'
import { definePlugin, html } from '../plugin'
import { encode, decode } from '../utils/bv-encode'
const { trim, slice, indexOf } = $string

const REG_AV = /^([aA][vV]\d+)/
const REG_BV = /^([bB][vV]1\w{9})/
const toShortUrl = (id: string) => `https://b23.tv/${id}`
const toUrl = (id: string) => `https://www.bilibili.com/video/${id}/`

export const main = definePlugin({
  include: [
    REG_AV, REG_BV,
    /^(?:https?:\/\/)?b23\.tv\/([aA][vV]\d+|[bB][vV]1\w{9})/,
    /^(?:https?:\/\/)?www\.bilibili\.com\/video\/([aA][vV]\d+|[bB][vV]1\w{9})/
  ],
  resolve(m) {
    let id = m[1]
    if (test(REG_AV, id)) {
      id = `av${slice(id, 2)}`
    } else if (test(REG_BV, id)) {
      id = decode(id) ?? `BV1${slice(id, 3)}`
    }
    return { id, rawId: id, shortUrl: toShortUrl(id), url: toUrl(id) }
  },
  async parse(info) {
    let { rawId: id, shortUrl, url } = info
    const { text, $ } = await html(info)
    if (test(REG_BV, id)) {
      let aid = match(RegExp(`"videoData":\\{"bvid":"[bB][vV]1${slice(id, 3)}","aid":(\\d+),`), text)?.[1]
      if (aid != null) {
        id = `av${aid}`
        shortUrl = toShortUrl(id)
        url = toUrl(id)
      }
    }

    let thumb = $('meta[property="og:image"]').attr('content'), index = 0
    thumb = thumb ? new URL(thumb, url).href : ''
    if ((index = indexOf(thumb, '@')) > 0) {
      thumb = slice(thumb, 0, index)
    }
    return {
      title: trim($('.video-title').text()),
      ownerName: trim($('.up-name').text()),
      publishDate: trim($('.pubdate-text').text()),
      shortUrl, url, thumbnailUrl: thumb,
      description: trim($('.basic-desc-info').text())
    }
  }
})

definePlugin({
  include: [
    /^bv!([aA][vV]\d+)/,
    /^raw!([bB][vV]1\w{9})/
  ],
  resolve(m) {
    let i = indexOf(m[0], '!')
    let type = i > 0 ? slice(m[0], 0, i) : null
    let rawId, id
    switch (type) {
      case 'bv': {
        let aid = slice(m[1], 2)
        id = rawId = encode(aid) ?? `av${aid}`
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
