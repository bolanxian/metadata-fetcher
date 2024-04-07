
import { $string, dateToLocale } from '../bind'
import { definePlugin, html } from '../plugin'
const { startsWith, slice, indexOf, lastIndexOf } = $string

const name = 'youtube'
export default definePlugin({
  include: [
    /^youtube[!:]([-\w]+)/,
    /^(?:https?:\/\/)?youtu\.be\/([-\w]+)/,
    /^(?:https?:\/\/)?www\.youtube\.com\/shorts\/([-\w]+)/,
    /^(?:https?:\/\/)?www\.youtube\.com\/watch\?v=([-\w]+)/
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
    let _
    for (const script of $('script')) {
      const text = $(script).text()
      if (startsWith(text, 'var ytInitialPlayerResponse = ')) {
        _ = JSON.parse(slice(text, indexOf(text, '{'), lastIndexOf(text, '}') + 1))
        break
      }
    }
    const init = _.microformat.playerMicroformatRenderer
    let date = init.publishDate
    date = date ? dateToLocale(date) : ''
    return {
      title: init.title.simpleText,
      ownerName: init.ownerChannelName,
      publishDate: date,
      shortUrl, url,
      thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? '',
      description: init.description?.simpleText ?? '',
      _
    }
  }
})