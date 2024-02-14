
import { match, test, dateToLocale, htmlToText } from '../bind'
import { definePlugin, html } from '../plugin'
import type { ResolvedInfo, ParsedInfo } from '../plugin'

const table: Record<string, {
  reg: RegExp[]
  url(id: string): string
  parse(_: ResolvedInfo & Awaited<ReturnType<typeof html>>): ParsedInfo | Promise<ParsedInfo>
}> = {
  __proto__: null!,
  douga: {
    reg: [
      /^(sm\d+)/,
      /^(?:https?:\/\/)?www\.nicovideo\.jp\/watch\/(sm\d+)/
    ],
    url: (id) => `https://www.nicovideo.jp/watch/${id}`,
    parse({ $ }) {
      const $data = $('#js-initial-watch-data[data-api-data]')
      const _ = JSON.parse($data.attr('data-api-data')!)
      return {
        title: _.video.title,
        ownerName: _.owner.nickname,
        publishDate: dateToLocale(_.video.registeredAt),
        url: this.url(_.video.id),
        thumbnailUrl: _.video.thumbnail.url,
        description: htmlToText($data, _.video.description),
        _
      }
    }
  },
  seiga: {
    reg: [
      /^(im\d+)/,
      /^(?:https?:\/\/)?seiga\.nicovideo\.jp\/seiga\/(im\d+)/
    ],
    url: (id) => `https://seiga.nicovideo.jp/seiga/${id}`,
    parse({ $ }) {
      return {
        title: $('.lg_ttl_illust h1').text(),
        ownerName: $('.lg_txt_illust strong').text(),
        publishDate: $('.lg_txt_date').text(),
        url: $('meta[property="og:url"]').attr('content') ?? '',
        thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? '',
        description: $('.lg_txt_illust:nth-child(3)').text()
      }
    }
  },
  '3d': {
    reg: [
      /^(td\d+)/,
      /^(?:https?:\/\/)?3d\.nicovideo\.jp\/works\/(td\d+)$/
    ],
    url: (id) => `https://3d.nicovideo.jp/works/${id}`,
    parse({ $ }) {
      const { work } = JSON.parse($('[data-state]').attr('data-state')!)
      const url = this.url(`td${work.id}`)
      return {
        title: work.title,
        ownerName: work.user.nickname,
        publishDate: $('.work-info-meta-item:nth-child(1)').text(),
        url, thumbnailUrl: new URL(work.thumbnail_url, url).href,
        description: $('.work-info .description').text(),
        _: work
      }
    }
  },
  commons: {
    reg: [
      /^(nc\d+)/,
      /^(?:https?:\/\/)?commons\.nicovideo\.jp\/works\/(nc\d+)$/
    ],
    url: (id) => `https://commons.nicovideo.jp/works/${id}`,
    parse({ $ }) {
      return {
        title: $('meta[property="og:title"]').attr('content') ?? '',
        ownerName: '',
        publishDate: '',
        url: $('meta[property="og:url"]').attr('content') ?? '',
        thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? '',
        description: $('meta[property="og:description"]').attr('content') ?? ''
      }
    }
  }
}

export default definePlugin({
  resolve(input) {
    for (const name of Object.keys(table)) {
      const v = table[name]
      for (const reg of v.reg) {
        const m = match(reg, input)
        if (m != null) {
          const id = m[1]
          return { id, url: v.url(id) }
        }
      }
    }
    return null
  },
  async parse({ id, url }) {
    for (const name of Object.keys(table)) {
      const _ = table[name]
      if (test(_.reg[0], id)) {
        const { text, $ } = await html(url)
        return _.parse({ id, url, text, $ })
      }
    }
    return null!
  }
})