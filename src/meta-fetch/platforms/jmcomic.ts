
import { test, match } from 'bind:utils'
import { join } from '@/bind'
import { instantToString } from '@/utils/temporal'
import { $fetch, jsonInit } from '../fetch'
import { defineDiscover } from '../discover'
import { definePlugin } from '../plugin'
const SSR = import.meta.env.TARGET == 'server'
const { now } = Date
const apiHost = 'www.cdnhth.cc'

export const REG_JM = /^[Jj][Mm]((?!0\d)\d+)$/

defineDiscover({
  name: 'Jm',
  discover: [REG_JM],
  discoverHttp: [
    /^(?:18comic|jm-?comic\d?|comic18j-[\da-z]+)\.[a-z]{2,4}\/(?:album(?:_download)?|photo)\/((?!0\d)\d+)(?!\w)/
  ],
  handle: m => `jmcomic/album/${m[1]}`
})
definePlugin<any>({
  name: 'Jm',
  path: 'jmcomic/album',
  resolve(path) {
    if (path.length !== 1) { return }
    let id = `jm${path[0]}`
    if (!test(REG_JM, id)) { return }
    const url = `https://jmcomic1.me/album/${path[0]}`
    return { id, displayId: id, cacheId: id, shortUrl: '', url }
  },
  async fetch(cache, info) {
    if (!SSR) { return }
    return await cache.json(info.id, () => {
      const id = match(REG_JM, info.id)![1]!
      return getAlbum(id)
    })
  },
  parse: {
    title: $ => $.name,
    ownerName: $ => join($.author, '；'),
    publishDate: $ => instantToString(+$.addtime * 1000),
    keywords: $ => join($.tags, ','),
    description: $ => $.description,
  }
})

let Buffer: typeof import('node:buffer').Buffer
let crypto: typeof import('node:crypto')

const md5 = (data: string) => crypto.createHash('md5').update(data).digest('hex')
const decryptData = (ts: number, encryptedData: Buffer) => {
  const key = Buffer.from(md5(`${ts}185Hcomic3PAPP7R`), 'utf-8')
  const cipher = crypto.createDecipheriv('aes-256-ecb', key, null)
  const a = cipher.update(encryptedData)
  const b = cipher.final()
  return Buffer.concat([a, b]).toString('utf-8')
}

const getAlbum = async (id: string) => {
  Buffer ??= (await import('node:buffer')).Buffer
  crypto ??= await import('node:crypto')

  const ts = Math.trunc(now() / 1000)
  const token = md5(`${ts}18comicApp`)
  const tokenparam = `${ts},2.0.13`

  const resp = await (await $fetch(`https://${apiHost}/album?id=${id}`, {
    ...jsonInit,
    headers: { ...jsonInit.headers, token, tokenparam }
  })).json()

  const encryptedData = Buffer.from(resp.data, 'base64')
  const decryptedData = decryptData(ts, encryptedData)

  const data = JSON.parse(decryptedData)
  data.related_list = null
  return data
}
