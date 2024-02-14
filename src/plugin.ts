
import * as cheerio from 'cheerio'
import { $string } from './bind'
const { trim } = $string

export interface Plugin {
  resolve(id: string): ResolvedInfo | null
  parse(info: ResolvedInfo): Promise<ParsedInfo>
}
export interface ResolvedInfo {
  id: string
  url: string
}
export interface ParsedInfo {
  title: string
  ownerName: string
  publishDate: string
  url: string
  thumbnailUrl: string
  description: string
}

const plugins: Plugin[] = []
export const definePlugin = (plugin: Plugin) => {
  plugins[plugins.length] = plugin
  return plugin
}
export const resolve = (input: string): ResolvedInfo | null => {
  input = trim(input)
  for (const plugin of plugins) {
    const resolved = plugin.resolve(input)
    if (resolved != null) { return resolved }
  }
  return null
}
export const parse = (input: string): Promise<ParsedInfo> | null => {
  input = trim(input)
  for (const plugin of plugins) {
    const resolved = plugin.resolve(input)
    if (resolved != null) { return plugin.parse(resolved) }
  }
  return null
}
export const render = (parsed: ParsedInfo) => {
  const { title, ownerName, publishDate, url, thumbnailUrl, description } = parsed
  return `\
标题：${title}
UP主：${ownerName}
日期：${publishDate}
链接：${url}
封面：${thumbnailUrl}
简介：${description}
`
}

const _headers = {
  'accept-language': '*',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
}
const _init: RequestInit = {
  headers: _headers,
  method: 'GET',
  referrerPolicy: 'no-referrer',
  credentials: 'omit'
}

const $fetch = fetch, SSR = import.meta.env.SSR
if (SSR) {
  try {
    //@ts-expect-error
    Deno.mkdirSync(`./__cache__`)
  } catch (error) {
    //@ts-expect-error
    if (!(error instanceof Deno.errors.AlreadyExists)) { throw error }
  }
}

export const html = SSR ? async (url: string) => {
  const info = resolve(url)
  let path = info != null ? `./__cache__/${info.id}.html` : null
  if (path != null) {
    try {
      //@ts-expect-error
      const text = await Deno.readTextFile(path)
      const $ = cheerio.load(text)
      return { text, $ }
    } catch (error) {
      //@ts-expect-error
      if (!(error instanceof Deno.errors.NotFound)) { throw error }
    }
  }
  const resp = await $fetch(url, {
    ..._init,
    headers: {
      ..._headers,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    }
  })
  const { status } = resp
  if (status !== 200) {
    throw new TypeError(`Request failed with status code ${status}`)
  }
  const text = await resp.text()
  //@ts-expect-error
  path != null ? await Deno.writeTextFile(path, text) : null
  const $ = cheerio.load(text)
  return { text, $ }
} : null!

export const json = SSR ? async (url: string) => {
  const resp = await $fetch(url, {
    ..._init,
    headers: {
      ..._headers,
      'accept': 'application/json, text/plain, */*'
    }
  })
  const { status } = resp
  if (status !== 200) {
    throw new TypeError(`Request failed with status code ${status}`)
  }
  return await resp.json()
} : null!