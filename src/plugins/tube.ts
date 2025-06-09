

import { hasOwn, replace } from 'bind:utils'
import { slice, indexOf } from 'bind:String'
import { find, map, join } from 'bind:Array'
import { definePlugin, html } from '../plugin'
import { fromHTML } from '../utils/find-json-object'
import { parseRfc2822Date } from '../utils/temporal'

const name = 'youtube'
const host = `www.${name}.com`
export default definePlugin({
  include: [
    /^youtube[!:]([-\w]+)/,
    /^(?:https?:\/\/)?youtu\.be\/([-\w]+)/,
    /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:shorts|embed)\/([-\w]+)/,
    /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:\S*?&)??v=([-\w]+)/
  ],
  resolve({ 1: m1 }) {
    return {
      id: `${name}!${m1}`,
      rawId: `${name}:${m1}`,
      shortUrl: `https://youtu.be/${m1}`,
      url: `https://${host}/watch?v=${m1}`
    }
  },
  async load(info) {
    const { $ } = await html(info)
    return fromHTML($, /^\s*var\s+ytInitialData\s*=\s*(?={)/)
  },
  async parse(data, info) {
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
