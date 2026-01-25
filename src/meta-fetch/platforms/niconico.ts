
import { test } from 'bind:utils'
import { slice } from 'bind:String'
import { htmlToText } from '@/bind'
import { config } from '@/config'
import type { BaseCache } from '../cache'
import { $fetch, jsonInit } from '../fetch'
import { defineDiscover } from '../discover'
import { definePlugin } from '../plugin'
export const REG_NICO = /^((?:sm|nm|im|td|nc)(?!0\d)\d+)$/
export type Work = {
  globalId: string
  contentId: number
  contentKind: string
  id: number
  updated: string
  parentsCount: number
  childrenCount: number
  kind: string
  title: string
  logoURL: string | null
  watchURL: string | null
  treeURL: string | null
  treeEditURL: string | null
  thumbnailURL: string
  description: string
  userId: number
  isEditable: boolean
}
export type User = Record<'userId' | 'nickname' | 'description', string>

export const toUrl = (id: string, type = slice(id, 0, 2)): string => {
  switch (type) {
    case 'sm': case 'nm': return `https://www.nicovideo.jp/watch/${id}`
    case 'im': return `https://seiga.nicovideo.jp/seiga/${id}`
    case 'td': return `https://3d.nicovideo.jp/works/${id}`
    case 'nc': return `https://commons.nicovideo.jp/works/${id}`
    default: return (void 0)!
  }
}
const getUser = async (cache: BaseCache, userId: string | number): Promise<User | null> => {
  const id = `nico!user!${userId}`
  const url = `https://account.nicovideo.jp/api/public/v1/users.json?userIds=${userId}`
  return await cache.json<User | null>(id, async () => {
    const $user = await (await $fetch(url, jsonInit)).json()
    if ($user?.meta?.status !== 200) {
      throw new TypeError(`Request json<${id}> failed.`, { cause: $user })
    }
    return $user.data[0] ?? null
  })
}
const transformWork = (id: string, work: Work) => {
  const watchURL = toUrl(id), treeURL = toUrl(id, 'nc')
  let set = false
  if (work.logoURL != null) { work.logoURL = null; set = true }
  if (work.watchURL === watchURL) { work.watchURL = null; set = true }
  if (work.treeURL === treeURL) { work.treeURL = null; set = true }
  if (work.treeEditURL === `${treeURL}/tree/parents/edit`) { work.treeEditURL = null; set = true }
  return set
}
const getWork = async (cache: BaseCache, id: string): Promise<Work> => {
  const url = `https://public-api.commons.nicovideo.jp/v1/works/${id}?with_meta=1`
  const work = await cache.json(id, async () => {
    const $work = await (await $fetch(url, jsonInit)).json()
    if ($work?.meta?.status !== 200) {
      throw new TypeError(`Request json<${id}> failed.`, { cause: $work })
    }
    const work: Work = $work.data.node
    transformWork(id, work)
    return work
  })
  if (transformWork(id, work)) {
    cache.set(`${id}.json`, JSON.stringify(work))
  }
  return work
}
defineDiscover({
  name: 'Niconico Works',
  discover: [REG_NICO],
  discoverHttp: [
    /^nico\.ms\/([a-z]{2}\d+)/,
    /^www\.nicovideo\.jp\/watch\/([sn]m\d+)/,
    /^seiga\.nicovideo\.jp\/seiga\/(im\d+)/,
    /^sp\.seiga\.nicovideo\.jp\/seiga\/#!\/(im\d+)/,
    /^3d\.nicovideo\.jp\/works\/(td\d+)/,
    /^commons\.nicovideo\.jp\/material\/(nc\d+)/,
    /^commons\.nicovideo\.jp\/works\/([a-z]{2}\d+)/
  ],
  handle: m => `niconico/works/${m[1]}`
})
definePlugin<{ work: Work, user: User | null }>({
  name: 'Niconico Works',
  path: 'niconico/works',
  resolve(path) {
    if (path.length !== 1) { return }
    const id: string = path[0]!
    if (!test(REG_NICO, id)) { return }
    const url = toUrl(id, config.nicoUrlType !== 'tree' ? void 0 : 'nc')
    const shortUrl = `https://nico.ms/${id}`
    return { id, displayId: id, cacheId: id, shortUrl, url }
  },
  async fetch(cache, { id }) {
    const work = await getWork(cache, id)
    const user = await getUser(cache, work.userId)
    return { work, user }
  },
  parse({ work, user }, info) {
    const { title, contentKind, description: desc } = work
    return {
      title,
      ownerName: user?.nickname,
      ownerUrl: `https://www.nicovideo.jp/user/${work.userId}`,
      thumbnailUrl: work.thumbnailURL,
      description: contentKind !== 'commons' ? htmlToText(desc) : desc
    }
  }
})
