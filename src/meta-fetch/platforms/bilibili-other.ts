
import * as cheerio from 'cheerio'
import { test, match } from 'bind:utils'
import { defineDiscover } from '../discover'
import { definePlugin } from '../plugin'
import { $fetch, htmlInit, jsonInit } from '../fetch'
import { cache, json } from '../cache'
import { REG_INIT } from './bilibili-video'
import { instantToString } from '@/utils/temporal'
import { fromHTML } from '@/utils/find-json-object'
export const REG_CV = /^cv((?!0\d)\d+)$/
export const REG_DYN = /^bili!dyn!(\d{18,})$/

defineDiscover({
  name: 'Bilibili article',
  discover: [REG_CV],
  discoverHttp: [
    /^www\.bilibili\.com\/(?:read\/cv|mobile\?id=)(\d+)/
  ],
  handle: m => `bilibili/article/cv${m[1]}`
})
defineDiscover({
  name: 'Bilibili dynamic',
  discover: [REG_DYN],
  discoverHttp: [
    /^t\.bilibili\.com\/(\d{18,})/,
    /^(?:m|www)\.bilibili\.com\/opus\/(\d{18,})/
  ],
  handle: m => `bilibili/dynamic/${m[1]}`
})

definePlugin({
  name: 'Bilibili article',
  path: 'bilibili/article',
  resolve(path) {
    if (path.length !== 1) { return }
    const id = path[0]
    if (!test(REG_CV, id)) { return }
    return {
      id, displayId: id, cacheId: id,
      shortUrl: '', url: `https://www.bilibili.com/read/${id}/`
    }
  },
  async fetch(info) {
    const { url, cacheId } = info
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
    return fromHTML($, REG_INIT)
  },
  parse(data, info) {
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
  name: 'Bilibili dynamic',
  path: 'bilibili/dynamic',
  resolve(path) {
    if (path.length !== 1) { return }
    const oid = path[0]
    const id = `bili!dyn!${oid}`
    if (!test(REG_DYN, id)) { return }
    return {
      id, displayId: id, cacheId: id,
      shortUrl: `https://t.bilibili.com/${oid}`,
      url: `https://www.bilibili.com/opus/${oid}`
    }
  },
  async fetch({ id }) {
    const oid = match(REG_DYN, id)![1]
    return await json(cache, id, async () => {
      const data = await (await $fetch(`https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=${oid}`, jsonInit)).json()
      let msg
      switch (data.code) {
        case 0: return data.data.item
        default: msg = `Unknown Error (${data.code}): ${data.message}`; break
      }
      throw new TypeError(msg, { cause: data })
    })
  },
  parse(data, info) {
    let { shortUrl, url } = info
    const { module_author: author, module_dynamic: dynamic } = data.modules
    return {
      title: '',
      ownerName: author.name,
      publishDate: '',
      shortUrl, url,
      thumbnailUrl: dynamic.major?.draw?.items[0].src,
      description: dynamic.desc.text
    }
  }
})