

import { $string, $array, hasOwn, replace } from '../bind'
import { definePlugin, html } from '../plugin'
import { fromHTML } from '../utils/find-json-object'
const { slice, indexOf, } = $string, { find, map, join } = $array

const name = 'youtube'
export default definePlugin({
  include: [
    /^youtube[!:]([-\w]+)/,
    /^(?:https?:\/\/)?youtu\.be\/([-\w]+)/,
    /^(?:https?:\/\/)?www\.youtube\.com\/(?:shorts|embed)\/([-\w]+)/,
    /^(?:https?:\/\/)?www\.youtube\.com\/watch\?(?:\S*?&)??v=([-\w]+)/
  ],
  resolve({ 1: m1 }) {
    return {
      id: `${name}!${m1}`,
      rawId: `${name}:${m1}`,
      shortUrl: `https://youtu.be/${m1}`,
      url: `https://www.${name}.com/watch?v=${m1}`
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

    const description = (({ content, commandRuns }) => {
      return replace(RegExp(
        join(map(commandRuns, $ => `(?<=^.{${+$.startIndex}}).{${+$.length}}`), '|'), 'sg'
      ), content, (_, index) => {
        const command = find(commandRuns, $ => $.startIndex === index)
        const ep = command.onTap.innertubeCommand.urlEndpoint
        if (ep == null) { return _ }
        return new URL(ep.url).searchParams.get('q') ?? _
      })
    })(videoDesc[1].attributedDescription)

    return {
      title: videoDesc[0].title.runs[0].text,
      ownerName: videoDesc[1].owner.videoOwnerRenderer.title.runs[0].text,
      publishDate: videoDesc[0].dateText.simpleText,
      shortUrl, url,
      thumbnailUrl: `https://i.ytimg.com/vi/${slice(id, indexOf(id, '!') + 1)}/hqdefault.jpg`,
      description
    }
  }
})
