
import { test } from 'bind:utils'
import { slice } from 'bind:String'
import { htmlToText } from '../bind'
import type { ResolvedInfo, ParsedInfo } from '../plugin'
import { definePlugin, json } from '../plugin'
export const REG_NICO = /^((?:sm|im|td|nc)(?!0\d)\d+)$/

const toShortUrl = (id: string) => `https://nico.ms/${id}`
const getUser = async (userId: string) => {
  const id = `nico!user!${userId}`
  return await json({ id, url: `https://account.nicovideo.jp/api/public/v1/users.json?userIds=${userId}` }, $user => {
    if ($user.meta.status !== 200) {
      throw new TypeError(`Request json<${id}> failed.`, { cause: $user })
    }
    return $user.data[0]
  })
}
const getWorks = async (id: string) => {
  return await json({ id, url: `https://public-api.commons.nicovideo.jp/v1/works/${id}?with_meta=1` }, $work => {
    if ($work.meta.status !== 200) {
      throw new TypeError(`Request json<${id}> failed.`, { cause: $work })
    }
    return $work.data.node
  })
}
const load = async (info: ResolvedInfo) => {
  const { id } = info
  const work = await getWorks(id)
  const user = await getUser(work.userId)
  return { work, user }
}
const parse = async ({ work, user }: any, info: ResolvedInfo): Promise<ParsedInfo> => {
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

definePlugin({
  include: [
    REG_NICO,
    /^(?:https?:\/\/)?nico\.ms\/([a-z]{2}\d+)/,
    /^(?:https?:\/\/)?www\.nicovideo\.jp\/watch\/(sm\d+)/,
    /^(?:https?:\/\/)?seiga\.nicovideo\.jp\/seiga\/(im\d+)/,
    /^(?:https?:\/\/)?3d\.nicovideo\.jp\/works\/(td\d+)/,
    /^(?:https?:\/\/)?commons\.nicovideo\.jp\/works\/([a-z]{2}\d+)/
  ],
  resolve({ 1: id }) {
    if (!test(REG_NICO, id)) { return null }
    let url: string
    switch (slice(id, 0, 2)) {
      case 'sm': url = `https://www.nicovideo.jp/watch/${id}`; break
      case 'im': url = `https://seiga.nicovideo.jp/seiga/${id}`; break
      case 'td': url = `https://3d.nicovideo.jp/works/${id}`; break
      case 'nc': url = `https://commons.nicovideo.jp/works/${id}`; break
      default: return null
    }
    return { id, rawId: id, shortUrl: toShortUrl(id), url }
  },
  load, parse
})
