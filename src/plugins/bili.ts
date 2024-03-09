
import { $string, test, match } from '../bind'
import { definePlugin, html } from '../plugin'
const { trim, slice, indexOf } = $string

const REG_AV = /^([aA][vV]\d+)/
const REG_BV = /^([bB][vV]1\w{9})/
const regs = [
  REG_AV, REG_BV,
  /^(?:https?:\/\/)?b23\.tv\/([aA][vV]\d+|[bB][vV]1\w{9})/,
  /^(?:https?:\/\/)?www\.bilibili\.com\/video\/([aA][vV]\d+|[bB][vV]1\w{9})/
]
const toShortUrl = (id: string) => `https://b23.tv/${id}`
const toUrl = (id: string) => `https://www.bilibili.com/video/${id}/`

export default definePlugin({
  resolve(input) {
    for (const reg of regs) {
      const m = match(reg, input)
      if (m != null) {
        let id = m[1]
        if (test(REG_AV, id)) {
          id = `av${slice(id, 2)}`
        } else if (test(REG_BV, id)) {
          id = `BV1${slice(id, 3)}`
        }
        return { id, shortUrl: toShortUrl(id), url: toUrl(id) }
      }
    }
    return null
  },
  async parse({ id, shortUrl, url }) {
    const { text, $ } = await html(url)
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