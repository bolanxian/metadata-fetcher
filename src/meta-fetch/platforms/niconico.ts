
import { test } from 'bind:utils'
import { slice } from 'bind:String'
import { htmlToText } from '@/bind'
import { config } from '@/config'
import { cache, json } from '../cache'
import { $fetch, jsonInit } from '../fetch'
import { defineDiscover } from '../discover'
import { definePlugin } from '../plugin'
export const REG_NICO = /^((?:sm|im|td|nc)(?!0\d)\d+)$/

const getUser = async (userId: string) => {
  const id = `nico!user!${userId}`
  const url = `https://account.nicovideo.jp/api/public/v1/users.json?userIds=${userId}`
  return await json(cache, id, async () => {
    const $user = await (await $fetch(url, jsonInit)).json()
    if ($user?.meta?.status !== 200) {
      throw new TypeError(`Request json<${id}> failed.`, { cause: $user })
    }
    return $user.data[0]
  })
}
const getWorks = async (id: string) => {
  const url = `https://public-api.commons.nicovideo.jp/v1/works/${id}?with_meta=1`
  return await json(cache, id, async () => {
    const $work = await (await $fetch(url, jsonInit)).json()
    if ($work?.meta?.status !== 200) {
      throw new TypeError(`Request json<${id}> failed.`, { cause: $work })
    }
    return $work.data.node
  })
}
defineDiscover({
  name: 'Niconico Works',
  discover: [REG_NICO],
  discoverHttp: [
    /^nico\.ms\/([a-z]{2}\d+)/,
    /^www\.nicovideo\.jp\/watch\/(sm\d+)/,
    /^seiga\.nicovideo\.jp\/seiga\/(im\d+)/,
    /^3d\.nicovideo\.jp\/works\/(td\d+)/,
    /^commons\.nicovideo\.jp\/material\/(nc\d+)/,
    /^commons\.nicovideo\.jp\/works\/([a-z]{2}\d+)/
  ],
  handle: m => `niconico/works/${m[1]}`
})
definePlugin<{ work: any, user: any }>({
  name: 'Niconico Works',
  path: 'niconico/works',
  resolve(path) {
    if (path.length !== 1) { return }
    const id = path[0]
    if (!test(REG_NICO, id)) { return }
    let url: string
    switch (config.nicoUrlType !== 'tree' ? slice(id, 0, 2) : 'nc') {
      case 'sm': url = `https://www.nicovideo.jp/watch/${id}`; break
      case 'im': url = `https://seiga.nicovideo.jp/seiga/${id}`; break
      case 'td': url = `https://3d.nicovideo.jp/works/${id}`; break
      case 'nc': url = `https://commons.nicovideo.jp/works/${id}`; break
      default: return
    }
    const shortUrl = `https://nico.ms/${id}`
    return { id, displayId: id, cacheId: id, shortUrl, url }
  },
  async fetch(info) {
    const { id } = info
    const work = await getWorks(id)
    const user = await getUser(work.userId)
    return { work, user }
  },
  parse({ work, user }, info) {
    const { shortUrl, url } = info
    const { title, updated, thumbnailURL, contentKind, description } = work
    const { nickname } = user
    return {
      title,
      ownerName: nickname,
      publishDate: updated,
      shortUrl, url,
      thumbnailUrl: thumbnailURL,
      description: contentKind !== 'commons' ? htmlToText(description) : description
    }
  }
})
