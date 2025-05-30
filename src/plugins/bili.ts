
import * as cheerio from 'cheerio'
import { hasOwn, test } from 'bind:utils'
import { slice, startsWith } from 'bind:String'
import { join } from 'bind:Array'
import component, { toUrl, toShortUrl } from '../components/bili.vue'
import { htmlToText } from '../bind'
import { getCache, json } from '../cache'
import { $fetch, definePlugin, htmlInit, jsonInit, html } from '../plugin'
import * as BV from '../utils/bv-encode'
import { fromHTML } from '../utils/find-json-object'
import { instantToString } from '../utils/temporal'

export { REG_AV, REG_BV } from '../utils/bv-encode'
export const REG_B23 = /^(?:https?:\/\/)?(?:b23\.tv|bili2{0,2}3{0,2}\.cn)\/([-\w]+)(?=$|[?#])/
export const REG_FULL = /^(?:https?:\/\/)?(?:m|www)\.bilibili\.com\/video\/(\w+)\/?(?=$|[?#])/
export const REG_WL = /^(?:https?:\/\/)?www\.bilibili\.com\/list\/watchlater\?(?:\S*?&)??bvid=(\w+)/
const REG_INIT = /^\s*window\.__INITIAL_STATE__\s*=\s*(?={)/
let channelKv: any

export const main = definePlugin<Record<'error' | 'redirect' | 'videoData' | 'tags' | 'channelKv', any>>({
  include: [BV.REG_AV, BV.REG_BV, REG_B23, REG_FULL, REG_WL],
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
  async load({ id, url }) {
    let data: any, extraData: any
    return {
      ...await json(id, async (id) => {
        let text = await getCache(`${id}.html`)
        if (text == null) {
          const resp = await $fetch(url, htmlInit)
          const { status } = resp
          if (status !== 200) {
            if (status >= 300 && status < 400) {
              const redirect = resp.headers.get('location')
              if (redirect != null) {
                const ret = await loadAsRedirect(id, redirect)
                if (ret.error != null) { extraData = ret; return }
                ret.error = {}
                return ret
              }
            }
            throw new TypeError(`Request failed with status code ${status}`)
          }
          text = await resp.text()
        }
        const $ = cheerio.load(text, { baseURI: url })
        data = fromHTML($, REG_INIT)
        let { error, videoData, tags } = data
        if (hasOwn(error, "trueCode") && hasOwn(error, "message")) {
          error = { code: error.trueCode, message: error.message }
        }
        return { error, videoData, tags }
      }),
      channelKv: channelKv ??= await json('bili!channel', () => data?.channelKv),
      ...extraData
    }
  },
  async parse(data, info) {
    if (data.error.message != null) { return null }
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
      const owners = []
      for (const { title, name } of videoData.staff) {
        owners[owners.length] = `${title != null ? `[${title}]` : ''}${name}`
      }
      ownerName = join(owners, '；')
    }
    return {
      title: videoData.title,
      ownerName,
      publishDate: instantToString(videoData.pubdate * 1000),
      shortUrl, url, thumbnailUrl: thumb,
      keywords: join(keywords, ','),
      description: htmlToText(videoData.desc, true)
    }
  },
  component
})

const loadAsRedirect = async (id: string, redirect: string) => {
  let query: string | undefined
  if (test(BV.REG_AV, id)) {
    query = `aid=${slice(id, 2)}`
  } else if (test(BV.REG_BV, id)) {
    query = `bvid=${id}`
  }
  if (query == null) {
    return { error: { code: -400, message: '请求错误' }, redirect }
  }
  const $view = await (await $fetch(`https://api.bilibili.com/x/web-interface/view?${query}`, jsonInit)).json()
  if ($view.data == null) {
    return { error: $view, redirect }
  }
  const $tags = await (await $fetch(`https://api.bilibili.com/x/tag/archive/tags?${query}`, jsonInit)).json()
  if ($tags.data == null) {
    return { error: $tags, redirect }
  }
  return { error: null, redirect, videoData: $view.data, tags: $tags.data }
}

definePlugin({
  include: [
    /^@redirect!(b23)!([-\w]+)/,
    /^bilibili:\/\/(video)\/(?!0\d)(\d{1,16})$/,
    /^(bv)!([aA][vV](?!0\d)\d{1,16})$/,
    /^(raw)!([bB][vV]1\w{9})$/
  ],
  resolve(m) {
    let rawId, id
    switch (m[1]) {
      case 'b23': {
        const url = toShortUrl(m[2])
        id = rawId = `@redirect!b23!${m[2]}`
        return { id, rawId, shortUrl: '', url }
      }
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
      publishDate: instantToString(readInfo.publish_time * 1000),
      shortUrl, url,
      thumbnailUrl: readInfo.banner_url,
      description: readInfo.summary
    }
  }
})
definePlugin({
  include: [
    /^bili!dyn!(\d{18,})/,
    /^(?:https?:\/\/)?t\.bilibili\.com\/(\d{18,})/,
    /^(?:https?:\/\/)?(?:m|www)\.bilibili\.com\/opus\/(\d{18,})/
  ],
  resolve(m) {
    const id = `bili!dyn!${m[1]}`
    return {
      id, rawId: m[1],
      shortUrl: `https://t.bilibili.com/${m[1]}`,
      url: `https://www.bilibili.com/opus/${m[1]}`
    }
  },
  async load({ id, rawId }) {
    return await json(id, async (id) => {
      const data = await (await $fetch(`https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=${rawId}`, jsonInit)).json()
      let msg
      switch (data.code) {
        case 0: return data.data.item
        default: msg = `Unknown Error (${data.code}): ${data.message}`; break
      }
      throw new TypeError(msg, { cause: data })
    })
  },
  async parse(data, info) {
    return null
  }
})
