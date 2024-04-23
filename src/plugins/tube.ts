
import { definePlugin, html } from '../plugin'
import { fromHTML } from '../utils/find-json-object'

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
  async parse(info) {
    const { shortUrl, url } = info
    const { $ } = await html(info)
    const _ = fromHTML($, /^\s*var\s+ytInitialPlayerResponse\s*=\s*(?={)/)
    const init = _.microformat.playerMicroformatRenderer
    return {
      title: init.title.simpleText,
      ownerName: init.ownerChannelName,
      publishDate: init.publishDate,
      shortUrl, url,
      thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? '',
      description: init.description?.simpleText ?? '',
      _
    }
  }
})
