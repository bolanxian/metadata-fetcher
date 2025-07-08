
import { test } from 'bind:utils'
import { slice } from 'bind:String'
import { htmlToText } from '../bind'
import { config } from '../config'
import { definePlugin, json } from '../plugin'
export const REG_NICO = /^((?:sm|im|td|nc)(?!0\d)\d+)$/

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

definePlugin<{ work: any, user: any }>({
  include: [REG_NICO],
  includeAsHttp: [
    /^nico\.ms\/([a-z]{2}\d+)/,
    /^www\.nicovideo\.jp\/watch\/(sm\d+)/,
    /^seiga\.nicovideo\.jp\/seiga\/(im\d+)/,
    /^3d\.nicovideo\.jp\/works\/(td\d+)/,
    /^commons\.nicovideo\.jp\/material\/(nc\d+)/,
    /^commons\.nicovideo\.jp\/works\/([a-z]{2}\d+)/
  ],
  resolve({ 1: id }) {
    if (!test(REG_NICO, id)) { return null }
    let url: string
    switch (config.nicoUrlType !== 'tree' ? slice(id, 0, 2) : 'nc') {
      case 'sm': url = `https://www.nicovideo.jp/watch/${id}`; break
      case 'im': url = `https://seiga.nicovideo.jp/seiga/${id}`; break
      case 'td': url = `https://3d.nicovideo.jp/works/${id}`; break
      case 'nc': url = `https://commons.nicovideo.jp/works/${id}`; break
      default: return null
    }
    const shortUrl = `https://nico.ms/${id}`
    return { id, rawId: id, shortUrl, url }
  },
  async load(info) {
    const { id } = info
    const work = await getWorks(id)
    const user = await getUser(work.userId)
    return { work, user }
  },
  async parse({ work, user }, info) {
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
