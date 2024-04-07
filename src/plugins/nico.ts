
import { match, dateToLocale, htmlToText } from '../bind'
import { definePlugin, defineRecursionPlugin, html } from '../plugin'

const toShortUrl = (id: string) => `https://nico.ms/${id}`

definePlugin({
  include: [
    /^(sm\d+)/,
    /^(?:https?:\/\/)?www\.nicovideo\.jp\/watch\/(sm\d+)/
  ],
  resolve({ 1: id }) {
    return { id, rawId: id, shortUrl: toShortUrl(id), url: `https://www.nicovideo.jp/watch/${id}` }
  },
  async parse(info) {
    const { shortUrl, url } = info
    const { $ } = await html(info)
    const $data = $('#js-initial-watch-data[data-api-data]')
    const _ = JSON.parse($data.attr('data-api-data')!)
    return {
      title: _.video.title,
      ownerName: _.owner.nickname,
      publishDate: dateToLocale(_.video.registeredAt),
      shortUrl, url,
      thumbnailUrl: _.video.thumbnail.url,
      description: htmlToText(_.video.description),
      _
    }
  }
})

definePlugin({
  include: [
    /^(im\d+)/,
    /^(?:https?:\/\/)?seiga\.nicovideo\.jp\/seiga\/(im\d+)/
  ],
  resolve({ 1: id }) {
    return { id, rawId: id, shortUrl: toShortUrl(id), url: `https://seiga.nicovideo.jp/seiga/${id}` }
  },
  async parse(info) {
    const { shortUrl } = info
    const { $ } = await html(info)
    return {
      title: $('#link_thumbnail_main img').attr('alt') || $('.lg_ttl_illust h1').text(),
      ownerName: $('.lg_txt_illust strong').text(),
      publishDate: $('.lg_txt_date').text(),
      shortUrl, url: $('meta[property="og:url"]').attr('content') ?? '',
      thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? '',
      description: $('.lg_txt_illust:nth-child(3)').text()
    }
  }
})

definePlugin({
  include: [
    /^(td\d+)/,
    /^(?:https?:\/\/)?3d\.nicovideo\.jp\/works\/(td\d+)/
  ],
  resolve({ 1: id }) {
    return { id, rawId: id, shortUrl: toShortUrl(id), url: `https://3d.nicovideo.jp/works/${id}` }
  },
  async parse(info) {
    const { shortUrl, url } = info
    const { $ } = await html(info)
    const { work } = JSON.parse($('[data-state]').attr('data-state')!)
    return {
      title: work.title,
      ownerName: work.user.nickname,
      publishDate: $('.work-info-meta-item:nth-child(1)').text(),
      shortUrl, url, thumbnailUrl: new URL(work.thumbnail_url, url).href,
      description: $('.work-info .description').text(),
      _: work
    }
  }
})

definePlugin({
  include: [
    /^(nc\d+)/,
    /^(?:https?:\/\/)?commons\.nicovideo\.jp\/works\/(nc\d+)/
  ],
  resolve({ 1: id }) {
    return { id, rawId: id, shortUrl: toShortUrl(id), url: `https://commons.nicovideo.jp/works/${id}` }
  },
  async parse(info) {
    const { shortUrl } = info
    const { text, $ } = await html(info)
    return {
      title: $('meta[property="og:title"]').attr('content') ?? '',
      ownerName: JSON.parse(match(/"nickname"\s*:\s*(".*?(?<!\\)")/s, text)?.[1] ?? '""'),
      publishDate: JSON.parse(match(/"created"\s*:\s*(".*?(?<!\\)")/s, text)?.[1] ?? '""'),
      shortUrl, url: $('meta[property="og:url"]').attr('content') ?? '',
      thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? '',
      description: $('meta[property="og:description"]').attr('content') ?? ''
    }
  }
})

defineRecursionPlugin([/^(?:https?:\/\/)?nico\.ms\/([a-z]{2}\d+)/])