
import * as cheerio from 'cheerio'
import { $string, hasOwn, on, off, match } from './bind'
import { ready as ready1, getCache, setCache } from './cache'
const { freeze } = Object
const { trim, split, startsWith } = $string
const TARGET = import.meta.env.TARGET
const SSR = TARGET == 'server'
const PAGES = TARGET == 'pages'

export interface Plugin {
  include: RegExp[]
  resolve(m: RegExpMatchArray, reg: RegExp): ResolvedInfo | null
  parse(info: ResolvedInfo): Promise<ParsedInfo | null>
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
  keywords?: string
  description: string
}

const plugins: Plugin[] = []
export const definePlugin = (plugin: Plugin) => {
  freeze(plugin)
  freeze(plugin.include)
  plugins[plugins.length] = plugin
  return plugin
}

const recursionResolve = (m: RegExpMatchArray) => resolve(m[1])
const recursionParse = ({ id }: ResolvedInfo) => parse(id)!
export const defineRecursionPlugin = (include: RegExp[]) => {
  return definePlugin({
    include, resolve: recursionResolve, parse: recursionParse
  })
}

export const resolve = (input: string): ResolvedInfo | null => {
  const [_] = xparse(input)
  return _ ?? null
}
export const parse = (input: string): Promise<ParsedInfo | null> | null => {
  const [, _] = xparse(input)
  return _ ?? null
}
export const xparse: {
  (input: string): [] | [ResolvedInfo, Promise<ParsedInfo | null>]
} = function* (input: string) {
  input = trim(input)
  for (const plugin of plugins) {
    for (const reg of plugin.include) {
      const m = match(reg, input)
      if (m != null) {
        const info = plugin.resolve(m, reg)
        if (info != null) {
          yield info
          if (startsWith(info.id, '@redirect!')) {
            yield redirect(info.url).then(url => url != null ? parse(url) : null)
          } else {
            yield plugin.parse(info)
          }
          return
        }
      }
    }
  }
} as any
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
export function* renderIds(args: string[], _template = template) {
  for (const arg of args) {
    const resolved = resolve(arg)
    if (resolved == null) {
      yield `Unknown Input : ${arg}`
      continue
    }
    const { rawId, url } = resolved
    yield `[${rawId}]${url}`
  }
}
export async function* renderList(args: string[], _template = template, render = renderListDefaultRender) {
  const _ = getSeparator(_template)
  for (const arg of args) {
    const [resolved, parsedPromise] = xparse(arg)
    if (resolved == null) {
      yield `Unknown Input : ${arg}`
      continue
    }
    const parsed = await parsedPromise
    if (parsed == null) {
      yield `Not Found : ${resolved.id}`
      continue
    }
    yield render(_, resolved, parsed)
  }
}
export const renderListDefaultRender = (
  _: string, { rawId }: ResolvedInfo, { title, ownerName }: ParsedInfo
) => `${title}${_}${rawId}${_}${ownerName}`
export const renderListNameRender = (
  _: string, { id }: ResolvedInfo, { title, ownerName }: ParsedInfo
) => `${ownerName ? `[${ownerName}]` : ''}[${id}]${title}`

export const getSeparator = (_template = template) => {
  return match(/^\s*separator=(.*?)\s*$/m, _template)?.[1] ?? '\uFF0F'
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
const templateName = '_template.txt'
export const readTemplate = SSR || PAGES ? async () => {
  template = await getCache(templateName) ?? template
  return template
} : null!
export const writeTemplate = async (_template = template): Promise<boolean> => {
  if (TARGET == 'client') {
    const resp = await fetch('./.template', {
      method: 'POST',
      body: _template,
      headers: {
        'content-type': 'text/plain'
      }
    })
    if (resp.ok) {
      template = _template
      return true
    }
    return false
  }
  if (SSR || PAGES) {
    await setCache(templateName, _template)
  }
  template = _template
  return true
}

export let $fetch = SSR || TARGET == 'koishi' ? fetch : null!
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
    $fetch = (await $grant)?.detail?.GM_fetch
  }
  if (SSR || PAGES) {
    await ready1
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

export const redirect = TARGET != 'client' ? async (url: string) => {
  const resp = await $fetch(url, { ...htmlInit, redirect: 'manual' })
  const { headers } = resp
  return headers.get('location')
} : null!

export const html = TARGET != 'client' ? async (info: { id: string, url: string }) => {
  const name = `${info.id}.html`
  let text = SSR || PAGES ? await getCache(name) : null
  if (text != null) {
    const $ = cheerio.load(text, { baseURI: info.url })
    return { text, $ }
  }
  const resp = await $fetch(info.url, htmlInit)
  const { status } = resp
  if (status !== 200) {
    throw new TypeError(`Request failed with status code ${status}`)
  }
  text = await resp.text()
  const $ = cheerio.load(text, { baseURI: info.url })
  SSR || PAGES ? await setCache(name, text) : null
  return { text, $ }
} : null!

export const json = TARGET != 'client' ? async <T = any>(
  info: { id: string, url: string }, transform?: (json: any) => Promise<T> | T
): Promise<T> => {
  const name = `${info.id}.json`
  let text = SSR || PAGES ? await getCache(name) : null
  if (text != null) {
    return JSON.parse(text)
  }
  const resp = await $fetch(info.url, jsonInit)
  const { status } = resp
  if (status !== 200) {
    throw new TypeError(`Request failed with status code ${status}`)
  }
  text = await resp.text()
  let data = JSON.parse(text)
  data = await transform?.(data) ?? data
  SSR || PAGES ? await setCache(name, JSON.stringify(data)) : null
  return data
} : null!