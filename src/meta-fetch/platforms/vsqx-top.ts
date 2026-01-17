
import { test, replace } from 'bind:utils'
import { slice } from 'bind:String'
import { cache } from '../cache'
import { $fetch, jsonInit } from '../fetch'
import { defineDiscover } from '../discover'
import { definePlugin, resolve } from '../plugin'

const DATE_REG = /^(\d\d\d\d)-(\d\d)-(\d\d)\s+(\d\d:\d\d:\d\d)$/
const DATE_STR = '$1-$2-$3T$4+08:00'
const REG_VSQX_TOP = /^(vn(?!0)\d+)$/

defineDiscover({
  name: 'vsqx.top',
  discover: [REG_VSQX_TOP],
  discoverHttp: [
    /^www\.vsqx\.top\/project\/(vn(?!0)\d+)/
  ],
  handle: m => `vsqx.top/project/${m[1]}`
})
definePlugin({
  name: 'vsqx.top',
  path: 'vsqx.top/project',
  resolve(path) {
    if (path.length !== 1) { return }
    const id = path[0]
    if (!test(REG_VSQX_TOP, id)) { return }
    const url = `https://www.vsqx.top/project/${id}`
    return { id, displayId: id, cacheId: id, shortUrl: '', url }
  },
  async fetch({ id }) {
    const url = `https://www.vsqx.top/api/app/project_msg/${slice(id, 2)}`
    return await cache.json(id, async () => {
      const $ = await (await $fetch(url, jsonInit)).json()
      if (!$.success) { throw new TypeError($.message || 'Unknown Error') }
      return $.data
    })
  },
  parse(data, { shortUrl, url }) {
    const relatedUrl = resolve(data.b_av ?? '')?.url
    return {
      title: data.music_name,
      ownerName: data.p_name,
      publishDate: replace(DATE_REG, data.up_time, DATE_STR),
      shortUrl, url, relatedUrl,
      thumbnailUrl: `https://vsqx-cover.vsqx.top/${data.vsqx_uid}.jpg`,
      description: data.music_desc
    }
  }
})
