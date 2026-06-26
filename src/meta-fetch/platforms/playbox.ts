
import { match } from 'bind:utils'
import { join } from '@/bind'
import { $fetch, jsonInit } from '../fetch'
import { defineDiscover } from '../discover'
import { definePlugin, resolve } from '../plugin'
const HOST = 'www.aplaybox.com'
const REG = /^aplaybox-(model|motion)[!:](\w+)$/

defineDiscover({
  name: 'PlayBox',
  discover: [REG],
  discoverHttp: [
    /^www\.aplaybox\.com\/details\/(model|motion)\/(\w+)/
  ],
  handle: m => `aplaybox/${m[1]}/${m[2]}`
})
definePlugin({
  name: 'PlayBox',
  path: 'aplaybox',
  resolve(path) {
    if (path.length !== 2) { return }
    const id = `aplaybox-${path[0]}!${path[1]}`
    const displayId = `aplaybox-${path[0]}:${path[1]}`
    const url = `https://www.aplaybox.com/details/${path[0]}/${path[1]}`
    return { id, displayId, cacheId: id, shortUrl: '', url }
  },
  async fetch(cache, { id, cacheId }) {
    const m = match(REG, id)!
    let work_type_id = 0
    switch (m[1]) {
      case 'model': work_type_id = 1; break
      case 'motion': work_type_id = 2; break
    }
    const url = 'https://api.aplaybox.com/api/web/v1/work/getWorkDetails'
    return await cache.json(cacheId, async () => {
      const resp = await $fetch(url, {
        ...jsonInit,
        method: "POST",
        headers: {
          ...jsonInit.headers,
          'Content-Type': 'application/json;charset=utf-8'
        },
        referrer: `https://${HOST}/`,
        body: JSON.stringify({ work_uuid: m[2], work_type_id, user_uid: '', is_login: 0 }),
      })
      const { status } = resp
      if (status !== 200) { throw new TypeError(`Request failed with status code ${status}`) }
      const $ = await resp.json()
      if (0 == $.data.status) {
        throw new TypeError(`Request json<${id}> failed.`, { cause: $ })
      }
      return $.data.result.data
    })
  },
  parse: {
    title: $ => $.work_name,
    ownerName: $ => $.nick_name,
    ownerUrl: $ => `https://${HOST}/u/${$.user_uid}`,
    relatedUrl(data) {
      const m = match(/bvid=(\w+)/, data.bilibili_url)
      return resolve(m?.[1] ?? '')?.url
    },
    thumbnailUrl: $ => $.cover,
    publishDate: $ => $.audited_at,
    keywords(data, info) {
      const keywords: string[] = []
      for (const { name } of data.work_tags) {
        keywords[keywords.length] = name
      }
      return join(keywords, ',')
    },
    description: $ => $.introduction,
  }
})
