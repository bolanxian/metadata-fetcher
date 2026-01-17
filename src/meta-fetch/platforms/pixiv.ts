
import { getOwn, test, match } from 'bind:utils'
import { join, htmlToText } from '@/bind'
import { cache } from '../cache'
import { $fetch, jsonInit } from '../fetch'
import { defineDiscover } from '../discover'
import { definePlugin } from '../plugin'
const REG_PIXIV = /^pixiv[!:](\d+)(?:[!-](\d+))?$/
const PAGE_COUNT = Symbol.for('meta-fetch:pixiv-pageCount')

defineDiscover({
  name: 'Pixiv',
  discover: [
    REG_PIXIV,
    /^pid=(\d+)$/,
    /^pixiv:\/\/illusts\/(\d+)(?=$|[?#])/
  ],
  discoverHttp: [
    /^www\.pixiv\.net\/artworks\/(\d+)(?=$|[?#])/
  ],
  handle(m) {
    const suffix = m[2] != null ? `/${m[2]}` : ''
    return `pixiv/illust/${m[1]}${suffix}`
  }
})
definePlugin({
  name: 'Pixiv',
  path: 'pixiv/illust',
  resolve(path) {
    let suffix = '', pid: string
    switch (path.length) {
      //@ts-expect-error
      case 2:
        suffix = `-${path[1]}`
      case 1:
        pid = path[0]
        break
      default: return
    }
    const id = `pixiv!${pid}${suffix}`
    if (!test(REG_PIXIV, id)) { return }
    return {
      id, shortUrl: '',
      displayId: `pixiv:${pid}${suffix}`,
      cacheId: `pixiv!${pid}`,
      url: `https://www.pixiv.net/artworks/${pid}`
    }
  },
  async fetch({ id, cacheId }) {
    const pid = match(REG_PIXIV, id)![1]
    return cache.json(cacheId, async () => {
      const url = `https://www.pixiv.net/ajax/illust/${pid}`
      const data = await (await $fetch(url, jsonInit)).json()
      if (data.error) {
        throw new TypeError(`Request json<${id}> failed.`, { cause: data })
      }
      const { body } = data
      delete body.zoneConfig
      delete body.noLoginData
      delete body.extraData
      return body
    })
  },
  parse(data, info) {
    const { title } = data
    const tags: string[] = []
    for (const { tag } of data.tags.tags) {
      tags[tags.length] = tag
    }
    let thumb: string | null = data.urls.thumb
    if (thumb == null) {
      const illusts = getOwn(data, 'userIllusts')
      if (illusts != null) {
        const pid = match(REG_PIXIV, info.id)![1]
        thumb = getOwn(illusts, pid)?.url
      }
    }
    return {
      [PAGE_COUNT]: data.pageCount,
      title,
      ownerName: data.userName,
      publishDate: data.uploadDate,
      thumbnailUrl: thumb ?? void 0,
      keywords: join(tags, ','),
      description: htmlToText(data.description)
    }
  }
})