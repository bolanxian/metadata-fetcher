
import * as cheerio from 'cheerio'
import { $string, hasOwn, on, off, match } from './bind'
import { ready as ready1, getCache, setCache } from './cache'
const { freeze } = Object
const { trim, split } = $string
const SSR = import.meta.env.SSR
const PAGES = import.meta.env.PAGES

export interface Plugin {
  include: RegExp[]
  resolve(m: RegExpMatchArray): ResolvedInfo | null
  parse(info: ResolvedInfo): Promise<ParsedInfo>
}
export interface ResolvedInfo {
  id: string
  rawId: string
  shortUrl: string
  url: string
}
export interface ParsedInfo {
  title: string
  ownerName: string
  publishDate: string
  shortUrl: string
  url: string
  thumbnailUrl: string
  description: string
}

const plugins: Plugin[] = []
export const definePlugin = (plugin: Plugin) => {
  freeze(plugin)
  freeze(plugin.include)
  plugins[plugins.length] = plugin
  return plugin
}
export const resolve = (input: string): ResolvedInfo | null => {
  input = trim(input)
  for (const plugin of plugins) {
    for (const reg of plugin.include) {
      const m = match(reg, input)
      if (m != null) {
        const info = plugin.resolve(m)
        if (info != null) {
          return info
        }
      }
    }
  }
  return null
}
export const parse = (input: string): Promise<ParsedInfo> | null => {
  input = trim(input)
  for (const plugin of plugins) {
    for (const reg of plugin.include) {
      const m = match(reg, input)
      if (m != null) {
        const info = plugin.resolve(m)
        if (info != null) {
          return plugin.parse(info)
        }
      }
    }
  }
  return null
}
export const render = (parsed: ParsedInfo, _template = template) => {
  let ret = ''
  for (let line of split(_template, '\n' as any)) {
    if (line = trim(line)) {
      const [key, name] = split(line, '=' as any)
      if (hasOwn(parsed, key)) {
        const value = parsed[key as keyof ParsedInfo]
        if (value) { ret += `${name}${value}\n` }
      }
    }
  }
  return ret
}
export async function* renderList(args: string[], _template = template) {
  let _ = '\uFF0F'
  for (let line of split(_template, '\n' as any)) {
    if (line = trim(line)) {
      const [key, name] = split(line, '=' as any)
      if (key === 'separator') { _ = name; break }
    }
  }
  for (const arg of args) {
    const resolved = resolve(arg)
    if (resolved != null) {
      const parsed = await parse(arg)
      if (parsed != null) {
        const { rawId } = resolved, { title, ownerName } = parsed
        yield `${title}${_}${rawId}${_}${ownerName}`
        continue
      }
    }
    yield ''
  }
}
export const defaultTemplate = `\
separator=\uFF0F
title=标题：
ownerName=UP主：
publishDate=日期：
shortUrl=链接：
thumbnailUrl=封面：
description=简介：
`
export let template = defaultTemplate
const templatePath = './__cache__/_template.txt'
export const readTemplate = SSR || PAGES ? async () => {
  template = await getCache(templatePath) ?? template
  return template
} : null!
export const writeTemplate = SSR || PAGES ? async (_template = template) => {
  await setCache(templatePath, _template)
  template = _template
} : null!

export let $fetch = SSR ? fetch : null!
export const ready = SSR || PAGES ? (async () => {
  if (PAGES) {
    const $grant = new Promise<CustomEvent | void>(ok => {
      const type = 'external:tampermonkey:grant'
      if (document.readyState === 'complete') { return ok() }
      const target = window, done = (e: any) => {
        ok(e.type === type ? e : null)
        off(target, type, done)
        off(target, 'load', done)
      }
      on(target, type, done)
      on(target, 'load', done)
    })
    await ready1
    $fetch = (await $grant)?.detail?.GM_fetch
  }
  if (SSR) {
    try {
      //@ts-expect-error
      await Deno.mkdir(`./__cache__`)
    } catch (error) {
      //@ts-expect-error
      if (!(error instanceof Deno.errors.AlreadyExists)) { throw error }
    }
  }
  if (SSR || PAGES) {
    await readTemplate()
  }
})() : null!

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
const htmlInit = {
  ..._init,
  headers: {
    ..._headers,
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
  }
}
const jsonInit = {
  ..._init,
  headers: {
    ..._headers,
    'accept': 'application/json, text/plain, */*'
  }
}

export const html = SSR || PAGES ? async (info: ResolvedInfo) => {
  const path = `./__cache__/${info.id}.html`
  let text = await getCache(path)
  if (text != null) {
    const $ = cheerio.load(text)
    return { text, $ }
  }
  const resp = await $fetch(info.url, htmlInit)
  const { status } = resp
  if (status !== 200) {
    throw new TypeError(`Request failed with status code ${status}`)
  }
  text = await resp.text()
  await setCache(path, text)
  const $ = cheerio.load(text)
  return { text, $ }
} : null!

export const json = SSR || PAGES ? async (info: ResolvedInfo) => {
  const path = `./__cache__/${info.id}.json`
  let text = await getCache(path)
  if (text != null) {
    return JSON.parse(text)
  }
  const resp = await $fetch(info.url, jsonInit)
  const { status } = resp
  if (status !== 200) {
    throw new TypeError(`Request failed with status code ${status}`)
  }
  text = await resp.text()
  await setCache(path, text)
  return JSON.parse(text)
} : null!