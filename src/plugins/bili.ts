
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
const toUrl = (id: string) => `https://www.bilibili.com/video/${id}/`

export default definePlugin({
  resolve(input) {
    for (const reg of regs) {
      const m = match(reg, input)
      if (m != null) {
        const id = m[1]
        return { id, url: toUrl(id) }
      }
    }
    return null
  },
  async parse({ id, url }) {
    const { text, $ } = await html(url)
    if (test(REG_BV, id)) {
      let aid = match(RegExp(`"videoData":\\{"bvid":"${id}","aid":(\\d+),`), text)?.[1]
      if (aid != null) {
        id = `av${aid}`
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
      url, thumbnailUrl: thumb,
      description: trim($('.basic-desc-info').text())
    }
  }
})