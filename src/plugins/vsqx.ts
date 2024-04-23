
import { $string, replace } from '../bind'
import { definePlugin, json, resolve } from '../plugin'
const { slice } = $string
const DATE_REG = /^(\d\d\d\d)-(\d\d)-(\d\d)\s+(\d\d:\d\d:\d\d)$/
const DATE_STR: any = '$1-$2-$3T$4+08:00'

definePlugin({
  include: [
    /^(vn\d+)/,
    /^(?:https?:\/\/)?www\.vsqx\.top\/project\/(vn\d+)/
  ],
  resolve({ 1: id }) {
    const url = `https://www.vsqx.top/project/${id}`
    return { id, rawId: id, shortUrl: '', url }
  },
  async parse(info) {
    let { shortUrl, url } = info
    const resp = await json({ ...info, url: `https://www.vsqx.top/api/app/project_msg/${slice(info.id, 2)}` })
    if (!resp.success) { throw new TypeError(resp.message || 'Unknown Error') }
    const { data } = resp
    const id = data.b_av
    if (id != null) {
      const info = resolve(id)
      info != null ? { shortUrl, url } = info : null
    }
    return {
      title: data.music_name,
      ownerName: data.p_name,
      publishDate: replace(DATE_REG, data.up_time, DATE_STR),
      shortUrl, url,
      thumbnailUrl: `https://vsqx-cover.vsqx.top/${data.vsqx_uid}.jpg`,
      description: data.music_desc
    }
  }
})
