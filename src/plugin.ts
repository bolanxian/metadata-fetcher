
import type { Component } from 'vue'
import * as cheerio from 'cheerio'
import { getOwn, $then as then, match, replace, on, off, getAsync } from 'bind:utils'
import { freeze } from 'bind:Object'
import { fromCharCode, includes, trim, split, startsWith, charCodeAt } from 'bind:String'
import { noop } from './bind'
import { ready as ready1, getCache, setCache } from './cache'
import { ready as ready2, config } from './config'

const TARGET = import.meta.env.TARGET
const SSR = TARGET == 'server'
const PAGES = TARGET == 'pages'

export interface Plugin<T extends {}> {
  include: RegExp[]
  resolve(m: RegExpMatchArray, reg: RegExp): ResolvedInfo | null
  load(info: ResolvedInfo): Promise<T | null>
  parse(data: T, info: ResolvedInfo): Promise<ParsedInfo | null>
  component?: Component<{ data: T }>
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

export const plugins: Plugin<{}>[] = []
export const definePlugin = <T extends {}>(plugin: Plugin<T>) => {
  freeze(plugin)
  freeze(plugin.include)
  plugins[plugins.length] = plugin as any
  return plugin
}

const recursionResolve = (m: RegExpMatchArray) => resolve(m[1])
const recursionLoad = () => null!
const recursionParse = (_: any, { id }: ResolvedInfo) => parse(id)!
export const defineRecursionPlugin = (include: RegExp[]) => {
  return definePlugin({
    include, resolve: recursionResolve, load: recursionLoad, parse: recursionParse
  })
}

export const resolve = (input: string): ResolvedInfo | null => {
  const [, _] = xparse(input)
  return _ ?? null
}
export const parse = (input: string): Promise<ParsedInfo | null> | null => {
  const [, , , , _] = xparse(input)
  return _ ?? null
}

const redirectParse = async (_url: string): Promise<[
  ResolvedInfo | undefined,
  Promise<{} | null> | undefined,
  Promise<ParsedInfo | null> | undefined
]> => {
  const url = await redirect(_url)
  if (url != null) {
    const [, resolved, redirected, data, parsed] = xparse(url)
    if (resolved != null) {
      return [redirected != null ? await redirected : resolved, data, parsed]
    }
  }
  return [void 0, void 0, void 0]
}
const defaultParse = async (plugin: Plugin<{}>, dataPromise: Promise<{} | null>, info: ResolvedInfo): Promise<ParsedInfo | null> => {
  const data = await dataPromise
  return data != null ? plugin.parse(data, info) : null
}
export const xparse: {
  (input: string): [Plugin<{}>?, ResolvedInfo?, Promise<ResolvedInfo>?, Promise<{} | null>?, Promise<ParsedInfo | null>?]
} = function* (input: string) {
  input = trim(input)
  for (const plugin of plugins) {
    for (const reg of plugin.include) {
      const m = match(reg, input)
      if (m != null) {
        const info = plugin.resolve(m, reg)
        if (info != null) {
          freeze(info)
          yield plugin
          yield info
          if (startsWith(info.id, '@redirect!')) {
            const promise = redirectParse(info.url)
            yield getAsync(promise, 0)
            yield getAsync(promise, 1)
            yield getAsync(promise, 2)
          } else {
            let data, parsed
            yield void 0
            then(data = plugin.load(info), null, noop)
            yield data
            then(parsed = defaultParse(plugin, data, info), null, noop)
            yield parsed
          }
          return
        }
      }
    }
  }
} as any
export const render = (parsed: ParsedInfo, template = config.template) => {
  let ret = ''
  for (let line of split(template, '\n')) {
    if (line = trim(line)) {
      const [key, name] = split(line, '=')
      const value = getOwn(parsed, key)
      if (value) { ret += `${name}${value}\n` }
    }
  }
  return ret
}

const LINE_REG = /\$\{(.+?)\}/g
export const renderLine = async (data: Record<string, string>, template: string) => {
  return replace(LINE_REG, template, ($0, $1) => {
    if (includes($1, '|')) {
      const [_sub, ...args] = split($1, '|')
      let val = getOwn(data, trim(_sub))
      if (val == null) { return $0 }
      for (let arg of args) {
        const fn: (str: string) => string = getOwn(renderLine, trim(arg)) as any
        val = fn(val)
      }
      return val
    }
    return getOwn(data, trim($1)) ?? $0
  })
}
const ESCAPE_REG = /(?<=^(?=av)|^a(?=v)|^(?=BV)|^B(?=V))./g
const ESCAPE_FUNC = ($0: string) => fromCharCode(charCodeAt($0, 0) + 0xFEE0)
renderLine.escape = (str: string) => replace(ESCAPE_REG, str, ESCAPE_FUNC)

export async function* renderBatch(args: string[], key: string) {
  const template = getOwn(config.batch, key)
  if (template == null) { yield `Unknown Template : ${key}`; return }
  const { separator } = config
  const sep = { separator, _: separator }
  const hasParse = key[0] !== '.'
  for (const arg of args) {
    let data: Record<string, string>
    if (hasParse) {
      const [, resolved, redirected, , parsedPromise] = xparse(arg)
      if (resolved == null) { yield `Unknown Input : ${arg}`; continue }
      const parsed = await parsedPromise
      if (parsed == null) { yield `Not Found : ${resolved.id}`; continue }
      data = { ...sep, ...resolved, ...redirected != null ? await redirected : null, ...parsed }
    } else {
      const [, resolved] = xparse(arg)
      if (resolved == null) { yield `Unknown Input : ${arg}`; continue }
      data = { ...sep, ...resolved }
    }
    yield renderLine(data, template)
  }
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
    await ready2
  }
})() : null!

export const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
const _headers = {
  'accept-language': '*',
  'user-agent': userAgent
}
const _init: RequestInit = {
  headers: _headers,
  method: 'GET',
  referrerPolicy: 'no-referrer',
  redirect: 'manual',
  credentials: 'omit'
}
export const htmlInit = {
  ..._init,
  headers: {
    ..._headers,
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
  }
}
export const jsonInit = {
  ..._init,
  headers: {
    ..._headers,
    'accept': 'application/json, text/plain, */*'
  }
}

export const redirect = TARGET != 'client' ? async (url: string) => {
  const resp = await $fetch(url, htmlInit)
  const { headers } = resp
  return headers.get('location')
} : null!

export const html = TARGET != 'client' ? async ({ id, url }: { id?: string, url: string }) => {
  const name = id != null ? `${id}.html` : null
  let text = SSR || PAGES ? name != null ? await getCache(name) : null : null
  if (text != null) {
    const $ = cheerio.load(text, { baseURI: url })
    return { text, $ }
  }
  const resp = await $fetch(url, htmlInit)
  const { status } = resp
  if (status !== 200) {
    throw new TypeError(`Request failed with status code ${status}`)
  }
  text = await resp.text()
  const $ = cheerio.load(text, { baseURI: url })
  SSR || PAGES ? name != null ? await setCache(name, text) : null : null
  return { text, $ }
} : null!

export const json = TARGET != 'client' ? async <T = any>(
  { id, url }: { id: string, url: string }, transform?: (json: any) => Promise<T> | T
): Promise<T> => {
  const name = id != null ? `${id}.json` : null
  let text = SSR || PAGES ? name != null ? await getCache(name) : null : null
  if (text != null) {
    return JSON.parse(text)
  }
  const resp = await $fetch(url, jsonInit)
  const { status } = resp
  if (status !== 200) {
    throw new TypeError(`Request failed with status code ${status}`)
  }
  text = await resp.text()
  let data = JSON.parse(text)
  if (transform != null) {
    data = await transform(data) ?? { __RAW_DATA__: data }
    SSR || PAGES ? name != null ? await setCache(name, JSON.stringify(data)) : null : null
  } else {
    SSR || PAGES ? name != null ? await setCache(name, text) : null : null
  }
  return data
} : null!