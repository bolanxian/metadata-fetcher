
import * as cheerio from 'cheerio'
import { hasOwn, test } from 'bind:utils'
import { slice } from 'bind:String'
import { keys } from 'bind:Object'
import { cache, json } from '../cache'
import { $fetch, htmlInit, jsonInit } from '../fetch'
import { defineDiscover } from '../discover'
import { definePlugin, redirectPlugin } from '../plugin'
import * as BV from '@/utils/bv-encode'
import { fromHTML } from '@/utils/find-json-object'
import { join, toHttps, htmlToText } from '@/bind'
import { instantToString } from '@/utils/temporal'

export { REG_AV, REG_BV } from '@/utils/bv-encode'
export const REG_B23 = /^(?:b23\.tv|bili2{0,2}3{0,2}\.cn)\/([-\w]+)(?=$|[?#])/
export const REG_FULL = /^(?:m\.|www\.)?bilibili\.com\/video\/(\w+)\/?(?=$|[?#])/
export const REG_WL = /^(?:www\.)?bilibili\.com\/list\/watchlater\/?\?(?:\S*?&)??bvid=(\w+)/
export const REG_INIT = /^\s*window\.__INITIAL_STATE__\s*=\s*(?={)/
export const toShortUrl = (id: string) => `https://b23.tv/${id}`
export const toUrl = (id: string) => `https://www.bilibili.com/video/${id}/`
export const toSpaceUrl = (id: string) => `https://space.bilibili.com/${id}/`

defineDiscover({
  name: 'Bilibili Video',
  discover: [BV.REG_AV, BV.REG_BV],
  discoverHttp: [REG_B23, REG_FULL, REG_WL],
  handle: (m, reg) => {
    let id: string
    if (test(BV.REG_AV, m[1])) {
      id = m[1]
    } else if (test(BV.REG_BV, m[1])) {
      id = BV.decode(m[1]) ?? m[1]
    } else if (reg === REG_B23) {
      return `bilibili/b23/${m[1]}`
    } else {
      return
    }
    return `bilibili/video/${id}`
  }
})
defineDiscover({
  name: 'Bilibili Extra',
  discover: [
    /^@(b23)!([-\w]+)$/,
    /^bilibili:\/\/(video)\/(?!0\d)(\d{1,16})$/,
    /^(bv)!([aA][vV](?!0\d)\d{1,16})$/,
    /^(raw)!([bB][vV]1\w{9})$/
  ],
  handle(m) {
    let id: string
    switch (m[1]) {
      case 'b23': return `bilibili/b23/${m[2]}`
      case 'video': id = `av${m[2]}`; break
      case 'bv': id = BV.encode(m[2]) ?? m[2]; break
      case 'raw': id = m[2]; break
      default: return
    }
    return `bilibili/video/${id}`
  }
})

export type Data = Record<'error' | 'redirect' | 'videoData' | 'tags' | 'channelKv', any>
let channelKv: any
export const bilibiliVideo = definePlugin<Data>({
  name: 'Bilibili Video',
  path: 'bilibili/video',
  resolve(path) {
    if (path.length !== 1) { return }
    let id = path[0], cacheId
    if (test(BV.REG_AV, id)) {
      id = cacheId = `av${slice(id, 2)}`
    } else if (test(BV.REG_BV, id)) {
      cacheId = `BV1${slice(id, 3)}`
      id = `raw!${cacheId}`
    } else {
      return
    }
    return {
      id, displayId: cacheId, cacheId,
      shortUrl: toShortUrl(cacheId), url: toUrl(cacheId)
    }
  },
  async fetch({ cacheId: id, url }) {
    let data: any, extraData: any
    return {
      error: null, redirect: null, videoData: null, tags: null,
      ...await json(cache, id, async () => {
        let text = await cache.get(`${id}.html`)
        if (text == null) {
          const resp = await $fetch(url, htmlInit)
          const { status } = resp
          if (status !== 200) {
            if (status >= 300 && status < 400) {
              const redirect = resp.headers.get('location')
              if (redirect != null) {
                const ret = await loadAsJson(id)
                if (ret.error != null) { extraData = ret; return }
                return { redirect, videoData: ret.videoData, tags: ret.tags }
              }
            }
            throw new TypeError(`Request failed with status code ${status}`)
          }
          text = await resp.text()
        }
        const $ = cheerio.load(text, { baseURI: url })
        data = fromHTML($, REG_INIT)
        if (data == null) {
          const ret = await loadAsJson(id)
          if (ret.error != null) { extraData = ret; return }
          return { videoData: ret.videoData, tags: ret.tags }
        }
        let { error, videoData, tags } = data
        if (keys(error).length !== 0) {
          error = { code: error.trueCode || error.code, message: error.message }
          extraData = { error }; return
        }
        return { videoData, tags }
      }),
      channelKv: channelKv ??= await json(cache, 'bili!channel', () => data?.channelKv) ?? null,
      ...extraData
    }
  },
  parse(data, info) {
    const { error, videoData } = data
    if (error != null && keys(error).length !== 0) { return }
    const { shortUrl, url } = info

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
        owners[owners.length] = `[${title}]${name}`
      }
      ownerName = join(owners, '；')
    }
    return {
      title: videoData.title,
      ownerName,
      publishDate: instantToString(videoData.pubdate * 1000),
      shortUrl, url,
      thumbnailUrl: toHttps(videoData.pic ?? ''),
      keywords: join(keywords, ','),
      description: htmlToText(videoData.desc, true)
    }
  }
})
const loadAsJson = async (id: string): Promise<
  { error: {} } | { error: null, videoData: any, tags: any }
> => {
  let query: string | undefined
  if (test(BV.REG_AV, id)) {
    query = `aid=${slice(id, 2)}`
  } else if (test(BV.REG_BV, id)) {
    query = `bvid=${id}`
  }
  if (query == null) {
    return { error: { code: -400, message: '请求错误' } }
  }
  const $view = await (await $fetch(`https://api.bilibili.com/x/web-interface/view?${query}`, jsonInit)).json()
  if ($view.data == null) {
    return { error: $view }
  }
  const $tags = await (await $fetch(`https://api.bilibili.com/x/tag/archive/tags?${query}`, jsonInit)).json()
  if ($tags.data == null) {
    return { error: $tags }
  }
  return { error: null, videoData: $view.data, tags: $tags.data }
}

definePlugin({
  name: 'Bilibili b23',
  path: 'bilibili/b23',
  resolve(path) {
    if (path.length !== 1) { return }
    const id = `@b23!${path[0]}`
    const url = toShortUrl(path[0])
    return { id, displayId: id, cacheId: id, shortUrl: '', url }
  },
  ...redirectPlugin
})
