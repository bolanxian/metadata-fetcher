
import { $string, match, dateToLocale } from '../bind'
import { definePlugin, html } from '../plugin'
const { startsWith, slice, indexOf, lastIndexOf } = $string

const REG_0 = /youtube!([-\w]+)/
const regs = [
  REG_0,
  /^(?:https?:\/\/)?youtu\.be\/([-\w]+)/,
  /^(?:https?:\/\/)?www\.youtube\.com\/watch\?v=([-\w]+)/
]
const toShortUrl = (id: string) => `https://youtu.be/${match(REG_0, id)![1]}`
const toUrl = (id: string) => `https://www.youtube.com/watch?v=${match(REG_0, id)![1]}`

export default definePlugin({
  resolve(input) {
    for (const reg of regs) {
      const m = match(reg, input)
      if (m != null) {
        const id = `youtube!${m[1]}`
        return { id, shortUrl: toShortUrl(id), url: toUrl(id) }
      }
    }
    return null
  },
  async parse({ id, url }) {
    const { $ } = await html(url)
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
      shortUrl: toShortUrl(id), url: toUrl(id),
      thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? '',
      description: init.description.simpleText,
      _
    }
  }
})