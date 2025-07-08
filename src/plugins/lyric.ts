
import { trim } from 'bind:String'
import { from, reverse, join } from 'bind:Array'
import { htmlToText } from '../bind'
import { definePlugin, html } from '../plugin'

definePlugin({
  include: [
    /^lyrical-nonsense!([-\w]+)!([-\w]+)/
  ],
  includeAsHttp: [
    /^www\.lyrical-nonsense\.com\/(?:global\/)?lyrics\/([-\w]+)\/([-\w]+)\//
  ],
  resolve(m) {
    const id = `lyrical-nonsense!${m[1]}!${m[2]}`
    const url = `https://www.lyrical-nonsense.com/global/lyrics/${m[1]}/${m[2]}/`
    return { id, rawId: id, shortUrl: '', url }
  },
  async load(info) {
    const { $ } = await html(info)
    return { $ }
  },
  async parse(data, info) {
    const { $ } = data, { url } = info
    let desc = ''
    for (const el of reverse(from($('.olyrictext')))) {
      let text = join(from($('.line-text', el), line => $(line).text()), '\n')
      if (!text) { text = trim(htmlToText(trim($(el).html()!))) }
      desc += `\n${text}\n`
    }
    return {
      title: $('input[type="hidden"][name="pagetitle"]').attr('value') ?? '',
      ownerName: '',
      publishDate: $('meta[property="article:modified_time"]').attr('content') ?? '',
      shortUrl: url, url,
      thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? '',
      description: desc
    }
  }
})
