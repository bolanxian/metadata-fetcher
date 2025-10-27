
import * as cheerio from 'cheerio'
import { hasOwn, test, match, replace } from 'bind:utils'
import { find, map, join } from 'bind:Array'
import { fromHTML } from '@/utils/find-json-object'
import { parseRfc2822Date } from '@/utils/temporal'
import { defineDiscover } from '../discover'
import { definePlugin } from '../plugin'
import { $fetch, htmlInit } from '../fetch'
import { cache } from '../cache'
const host = `www.youtube.com`
const REG_YOUTUBE = /^youtube[!:]([-\w]+)$/

defineDiscover({
  name: 'Youtube',
  discover: [REG_YOUTUBE],
  discoverHttp: [
    /^youtu\.be\/([-\w]+)/,
    /^(?:m\.|www\.)?youtube\.com\/(?:shorts|embed)\/([-\w]+)/,
    /^(?:m\.|www\.)?youtube\.com\/watch\?(?:\S*?&)??v=([-\w]+)/
  ],
  handle: m => `youtube/video/${m[1]}`
})
definePlugin<[any, any]>({
  name: 'Youtube',
  path: 'youtube/video',
  resolve(path) {
    if (path.length !== 1) { return }
    const id = `youtube!${path[0]}`
    if (!test(REG_YOUTUBE, id)) { return }
    return {
      id, cacheId: id,
      displayId: `youtube:${path[0]}`,
      shortUrl: `https://youtu.be/${path[0]}`,
      url: `https://${host}/watch?v=${path[0]}`
    }
  },
  async fetch(info) {
    const text = await cache.tryGet(`${info.id}.html`, async () => {
      const resp = await $fetch(info.url, htmlInit)
      const { status } = resp
      if (status !== 200) {
        throw new TypeError(`Request failed with status code ${status}`)
      }
      return await resp.text()
    })
    if (text == null) { return }
    const $ = cheerio.load(text, { baseURI: info.url })
    const data = fromHTML($, /^\s*var\s+ytInitialData\s*=\s*(?={)/)
    const contents = data.contents.twoColumnWatchNextResults.results.results.contents
    return map([
      'videoPrimaryInfoRenderer',
      'videoSecondaryInfoRenderer'
    ], name => find(contents, $ => hasOwn($, name))[name]) as any
  },
  parse(videoDesc, info) {
    const { id, shortUrl, url } = info
    const videoId = match(REG_YOUTUBE, id)![1]
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

    let title = '', ownerName = ''
    for (const { text } of videoDesc[0].title.runs) {
      title += text
    }
    for (const { text } of videoDesc[1].owner.videoOwnerRenderer.title.runs) {
      ownerName += text
    }
    const _date: string = videoDesc[0].dateText.simpleText
    let date = parseRfc2822Date(_date)
    date = date != null ? `${date}(${_date})` : _date

    const _desc = videoDesc[1].attributedDescription
    const description = _desc.commandRuns == null ? _desc.content : replace(RegExp(
      join(map(_desc.commandRuns, $ => `(?<=^.{${+$.startIndex}}).{${+$.length}}`), '|'), 'sg'
    ), _desc.content, (_, index) => {
      const command = find(_desc.commandRuns, $ => $.startIndex === index)
      const inner = command.onTap.innertubeCommand
      let ep: any, url: string | undefined
      if ((ep = inner.watchEndpoint) != null) {
        if (videoId === ep.videoId) { return _ }
        let suffix = ''
        if (ep.startTimeSeconds > 0) {
          suffix = `?t=${ep.startTimeSeconds}s`
        }
        return `https://youtu.be/${ep.videoId}${suffix}`
      }
      if ((ep = inner.reelWatchEndpoint) != null) {
        return `https://youtu.be/${ep.videoId}`
      }
      if ((ep = inner.urlEndpoint) != null) {
        url = ep.url
      } else if ((ep = inner.commandMetadata?.webCommandMetadata) != null) {
        switch (ep.webPageType) {
          case 'WEB_PAGE_TYPE_CHANNEL':
            url = ep.url; break
        }
      }
      if (url != null) {
        const inst = new URL(url, `https://${host}/`)
        if (inst.host === host && inst.pathname === '/redirect') {
          url = inst.searchParams.get('q') ?? inst.href
        } else {
          url = inst.href
        }
        return url
      }
      return _
    })

    return {
      title, ownerName, publishDate: date,
      shortUrl, url, thumbnailUrl, description
    }
  }
})
