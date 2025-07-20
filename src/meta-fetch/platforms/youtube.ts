
import * as cheerio from 'cheerio'
import { hasOwn, test, replace } from 'bind:utils'
import { slice, indexOf } from 'bind:String'
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
    /^(?:www\.)?youtube\.com\/(?:shorts|embed)\/([-\w]+)/,
    /^(?:www\.)?youtube\.com\/watch\?(?:\S*?&)??v=([-\w]+)/
  ],
  handle: m => `youtube/video/${m[1]}`
})
definePlugin({
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
    return fromHTML($, /^\s*var\s+ytInitialData\s*=\s*(?={)/)
  },
  parse(data, info) {
    const { id, shortUrl, url } = info

    const videoDesc = ((contents) => {
      return map([
        'videoPrimaryInfoRenderer',
        'videoSecondaryInfoRenderer'
      ], name => find(contents, $ => hasOwn($, name))[name]) as any[]
    })(data.contents.twoColumnWatchNextResults.results.results.contents)

    const _date = videoDesc[0].dateText.simpleText
    let date = parseRfc2822Date(_date)
    if (date != null) { date = `${date}(${_date})` }

    const description = (({ content, commandRuns }) => {
      if (commandRuns == null) { return content }
      return replace(RegExp(
        join(map(commandRuns, $ => `(?<=^.{${+$.startIndex}}).{${+$.length}}`), '|'), 'sg'
      ), content, (_, index) => {
        const command = find(commandRuns, $ => $.startIndex === index)
        const inner = command.onTap.innertubeCommand
        let ep: any
        if ((ep = inner.urlEndpoint) != null) {
          const url = new URL(ep.url)
          if (url.host === host && url.pathname === '/redirect') {
            return url.searchParams.get('q') ?? ep.url
          }
          return ep.url
        }
        if ((ep = inner.watchEndpoint) != null) {
          return `https://youtu.be/${ep.videoId}`
        }
        if ((ep = inner.reelWatchEndpoint) != null) {
          return `https://youtu.be/${ep.videoId}`
        }
        return _
      })
    })(videoDesc[1].attributedDescription)

    return {
      title: videoDesc[0].title.runs[0].text,
      ownerName: videoDesc[1].owner.videoOwnerRenderer.title.runs[0].text,
      publishDate: date ?? _date,
      shortUrl, url,
      thumbnailUrl: `https://i.ytimg.com/vi/${slice(id, indexOf(id, '!') + 1)}/hqdefault.jpg`,
      description
    }
  }
})
