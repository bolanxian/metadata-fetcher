
import { replace, htmlToText } from '../bind'
import { definePlugin, defineRecursionPlugin, html } from '../plugin'
import { fromHTML } from '../utils/find-json-object'
const DATE_REG = /^(\d\d\d\d)[-/年](\d\d)[-/月](\d\d)[日]?\s+(\d\d:\d\d(?::\d\d)?)(?:\s+投稿)?$/
const DATE_STR: any = '$1-$2-$3T$4+09:00'

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
      publishDate: _.video.registeredAt,
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
    const { shortUrl, url } = info
    const { $ } = await html(info)
    return {
      title: $('#link_thumbnail_main img').attr('alt') || $('.lg_ttl_illust h1').text(),
      ownerName: $('.lg_txt_illust strong').text(),
      publishDate: replace(DATE_REG, $('.lg_txt_date').text(), DATE_STR),
      shortUrl, url,
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
    const _ = JSON.parse($('[data-state]').attr('data-state')!)
    const { work } = _
    return {
      title: work.title,
      ownerName: work.user.nickname,
      publishDate: replace(DATE_REG, $('.work-info-meta-item:nth-child(1)').text(), DATE_STR),
      shortUrl, url,
      thumbnailUrl: new URL(work.thumbnail_url, url).href,
      description: $('.work-info .description').text(),
      _
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
    const { shortUrl, url } = info
    const { $ } = await html(info)
    const _ = fromHTML($, /^\s*var\s+app\s*=\s*(?={)/)
    const { ncCommons } = _
    return {
      title: ncCommons.name,
      ownerName: ncCommons.nickname,
      publishDate: replace(DATE_REG, ncCommons.created, DATE_STR),
      shortUrl, url,
      thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? '',
      description: ncCommons.description,
      _
    }
  }
})

defineRecursionPlugin([
  /^(?:https?:\/\/)?nico\.ms\/([a-z]{2}\d+)/,
  /^(?:https?:\/\/)?commons\.nicovideo\.jp\/works\/([a-z]{2}\d+)/
])
