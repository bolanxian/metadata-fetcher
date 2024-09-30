
import component, { toUrl, toShortUrl } from '../components/bili.vue'
import { $string, $array, hasOwn, test, dateToLocale, htmlToText } from '../bind'
import { definePlugin, html } from '../plugin'
import * as BV from '../utils/bv-encode'
import { fromHTML } from '../utils/find-json-object'
export { REG_AV, REG_BV } from '../utils/bv-encode'
export const REG_B23 = /^(?:https?:\/\/)?b23\.tv\/([-\w]+)(?=$|[?#])/
const { slice, startsWith } = $string, { join } = $array
const REG_INIT = /^\s*window\.__INITIAL_STATE__\s*=\s*(?={)/

export const main = definePlugin({
  include: [
    BV.REG_AV, BV.REG_BV, REG_B23,
    /^(?:https?:\/\/)?(?:m|www)\.bilibili\.com\/video\/(\w+)\/?(?=$|[?#])/
  ],
  resolve(m, reg) {
    let id = m[1]
    if (test(BV.REG_AV, id)) {
      id = `av${slice(id, 2)}`
    } else if (test(BV.REG_BV, id)) {
      id = BV.decode(id) ?? `BV1${slice(id, 3)}`
    } else if (reg === REG_B23) {
      const url = toShortUrl(id)
      id = `@redirect!b23!${id}`
      return { id, rawId: id, shortUrl: '', url }
    } else {
      return null
    }
    return { id, rawId: id, shortUrl: toShortUrl(id), url: toUrl(id) }
  },
  async load(info) {
    const { $ } = await html(info)
    return fromHTML($, REG_INIT)
  },
  async parse(data, info) {
    if (data.error.code === 404) { return null }
    let { rawId: id, shortUrl, url } = info
    const { videoData } = data
    const { aid } = videoData
    if (aid != null) {
      id = `av${aid}`
      shortUrl = toShortUrl(id)
      url = toUrl(id)
    }
    let thumb = videoData.pic ?? ''
    if (startsWith(thumb, 'http:')) {
      thumb = `https:${slice(thumb, 5)}`
    }
    const keywords = []
    for (const tag of data.tags) {
      if (tag.tag_type === 'old_channel') {
        keywords[keywords.length] = tag.tag_name
      }
    }

    let ownerName = videoData.owner.name
    if (hasOwn(videoData, 'staff')) {
      ownerName = ''
      for (const { name } of videoData.staff) {
        ownerName += `${name}；`
      }
    }

    return {
      title: videoData.title,
      ownerName,
      publishDate: dateToLocale(videoData.pubdate * 1000),
      shortUrl, url, thumbnailUrl: thumb,
      keywords: join(keywords, ','),
      description: htmlToText(videoData.desc, true)
    }
  },
  component
})

definePlugin({
  include: [
    /^bilibili:\/\/(video)\/(?!0\d)(\d{1,16})$/,
    /^(bv)!([aA][vV](?!0\d)\d{1,16})$/,
    /^(raw)!([bB][vV]1\w{9})$/
  ],
  resolve(m) {
    let rawId, id
    switch (m[1]) {
      case 'video': {
        id = rawId = `av${m[2]}`
      } break
      case 'bv': {
        rawId = BV.encode(m[2])
        if (rawId != null) {
          id = `raw!${rawId}`
        } else {
          id = rawId = `av${slice(m[2], 2)}`
        }
      } break
      case 'raw': {
        rawId = `BV1${slice(m[2], 3)}`
        id = `raw!${rawId}`
      } break
      default: return null
    }
    return { id, rawId, shortUrl: toShortUrl(rawId), url: toUrl(rawId) }
  },
  load: main.load,
  parse: main.parse
})

definePlugin({
  include: [
    /^cv(\d+)/,
    /^(?:https?:\/\/)?www\.bilibili\.com\/(?:read\/cv|mobile\?id=)(\d+)/
  ],
  resolve(m) {
    const id = `cv${m[1]}`
    return { id, rawId: id, shortUrl: '', url: `https://www.bilibili.com/read/${id}/` }
  },
  async load(info) {
    const { $ } = await html(info)
    return fromHTML($, REG_INIT)
  },
  async parse(data, info) {
    let { shortUrl, url } = info
    const { readInfo } = data
    return {
      title: readInfo.title,
      ownerName: readInfo.author.name,
      publishDate: dateToLocale(readInfo.publish_time * 1000),
      shortUrl, url,
      thumbnailUrl: readInfo.banner_url,
      description: readInfo.summary
    }
  }
})
