
import { htmlToText } from '../bind'
import type { ResolvedInfo, ParsedInfo } from '../plugin'
import { definePlugin, defineRecursionPlugin, json } from '../plugin'

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
const parse = async (info: ResolvedInfo): Promise<ParsedInfo> => {
  const { id, shortUrl, url } = info
  const { title, userId, updated, thumbnailURL, contentKind, description } = await getWorks(id)
  const { nickname } = await getUser(userId)
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
    /^(sm\d+)/,
    /^(?:https?:\/\/)?www\.nicovideo\.jp\/watch\/(sm\d+)/
  ],
  resolve({ 1: id }) {
    return { id, rawId: id, shortUrl: toShortUrl(id), url: `https://www.nicovideo.jp/watch/${id}` }
  },
  parse
})

definePlugin({
  include: [
    /^(im\d+)/,
    /^(?:https?:\/\/)?seiga\.nicovideo\.jp\/seiga\/(im\d+)/
  ],
  resolve({ 1: id }) {
    return { id, rawId: id, shortUrl: toShortUrl(id), url: `https://seiga.nicovideo.jp/seiga/${id}` }
  },
  parse
})

definePlugin({
  include: [
    /^(td\d+)/,
    /^(?:https?:\/\/)?3d\.nicovideo\.jp\/works\/(td\d+)/
  ],
  resolve({ 1: id }) {
    return { id, rawId: id, shortUrl: toShortUrl(id), url: `https://3d.nicovideo.jp/works/${id}` }
  },
  parse
})

definePlugin({
  include: [
    /^(nc\d+)/,
    /^(?:https?:\/\/)?commons\.nicovideo\.jp\/works\/(nc\d+)/
  ],
  resolve({ 1: id }) {
    return { id, rawId: id, shortUrl: toShortUrl(id), url: `https://commons.nicovideo.jp/works/${id}` }
  },
  parse
})

defineRecursionPlugin([
  /^(?:https?:\/\/)?nico\.ms\/([a-z]{2}\d+)/,
  /^(?:https?:\/\/)?commons\.nicovideo\.jp\/works\/([a-z]{2}\d+)/
])
