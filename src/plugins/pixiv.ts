
import { slice, indexOf } from 'bind:String'
import { htmlToText, join } from '../bind'
import { json } from '../cache'
import { definePlugin, $fetch, jsonInit } from '../plugin'

definePlugin({
  include: [
    /^pixiv[!:](\d+)(?:[!-]\d+)??$/,
    /^pid=(\d+)$/,
    /^pixiv:\/\/illusts\/(\d+)(?=$|[?#])/,
    /^(?:https?:\/\/)?www\.pixiv\.net\/artworks\/(\d+)(?=$|[?#])/
  ],
  resolve({ 1: m1 }, reg) {
    return {
      id: `pixiv!${m1}`,
      rawId: `pixiv:${m1}`,
      shortUrl: '',
      url: `https://www.pixiv.net/artworks/${m1}`
    }
  },
  async load({ id }) {
    return json(id, async (id) => {
      const pid = slice(id, indexOf(id, '!') + 1)
      const url = `https://www.pixiv.net/ajax/illust/${pid}`
      const data = await (await $fetch(url, jsonInit)).json()
      if (data.error) {
        throw new TypeError(`Request json<${id}> failed.`, { cause: data })
      }
      const { body } = data
      delete body.userIllusts
      delete body.zoneConfig
      delete body.noLoginData
      delete body.extraData
      return body
    })
  },
  async parse(data, info) {
    const { shortUrl, url } = info
    const { title, userName, uploadDate, description } = data
    const tags: string[] = []
    for (const { tag } of data.tags.tags) {
      tags[tags.length] = tag
    }
    return {
      title,
      ownerName: userName,
      publishDate: uploadDate,
      shortUrl, url,
      thumbnailUrl: '',
      keywords: join(tags, ','),
      description: htmlToText(description)
    }
  }
})