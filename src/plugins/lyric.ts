
import { $string, dateToLocale, htmlToText } from '../bind'
import { definePlugin, html } from '../plugin'
const { trim } = $string

definePlugin({
  include: [
    /^lyrical-nonsense!([-\w]+)!([-\w]+)/,
    /^(?:https?:\/\/)?www\.lyrical-nonsense\.com\/global\/lyrics\/([-\w]+)\/([-\w]+)\//
  ],
  resolve(m) {
    const id = `lyrical-nonsense!${m[1]}!${m[2]}`
    const url = `https://www.lyrical-nonsense.com/global/lyrics/${m[1]}/${m[2]}/`
    return { id, rawId: id, shortUrl: '', url }
  },
  async parse(info) {
    const { shortUrl, url } = info
    const { $ } = await html(info)
    let desc = ''
    for (const el of Array.from($('.olyrictext#prilyr')).reverse()) {
      desc += `\n${htmlToText(trim($(el).html()!))}`
    }
    return {
      title: $('input[type="hidden"][name="pagetitle"]').attr('value') ?? '',
      ownerName: '',
      publishDate: dateToLocale($('meta[property="article:modified_time"]').attr('content')) ?? '',
      shortUrl, url,
      thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? '',
      description: desc
    }
  }
})