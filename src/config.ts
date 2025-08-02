
import { assign, keys } from 'bind:Object'
import { cache } from './meta-fetch/cache'
const { parse, stringify } = JSON
const { error } = console

const TARGET = import.meta.env.TARGET
const SSR = TARGET == 'server'
const PAGES = TARGET == 'pages'
const configName = '_config.json'

export interface Config {
  browsers: null | Record<string, { name: string, args: string[] }>
  defaultBrowser: null | string
  separator: string
  template: string
  batch: Record<string, { name: string, template: string }>
  nicoUrlType: 'watch' | 'tree'
}
export const config: Config = {
  browsers: null,
  defaultBrowser: null,
  separator: '\uFF0F',
  template: `\
title=标题：
ownerName=UP主：
publishDate=日期：
shortUrl||url=链接：
thumbnailUrl=封面：
relatedUrl=相关链接：
description="简介：\\n"
`,
  batch: {
    '.id': { name: 'ID', template: '[${displayId}]${url}' },
    list: { name: '借物表', template: '${title}${_}${displayId}${_}${ownerName}' },
    name: { name: '文件名', template: '[${ownerName|filename}][${cacheId}]${title|filename}' },
    escape: { name: '', template: '［${displayId|escape}］${title}' },
  },
  nicoUrlType: 'watch'
}

export const readConfig = async () => {
  if (SSR || PAGES) {
    const data = await cache.get(configName)
    if (data != null) {
      assign(config, parse(data))
    }
  }
  return config
}
export const writeConfig = async (_config: Config) => {
  if (TARGET == 'client') {
    const resp = await fetch('./.config', {
      method: 'POST',
      body: stringify(_config),
      headers: {
        'content-type': 'application/json'
      }
    })
    if (resp.ok) {
      assign(config, _config)
      return true
    }
    return false
  }
  if (SSR || PAGES) {
    await cache.set(configName, stringify(_config))
    assign(config, _config)
  }
  return true
}

export const init = async () => {
  await readConfig()
  if (SSR) {
    if (config.browsers == null) {
      try {
        const cp = await import('node:child_process')
        const stream = await import('node:stream')
        const { stdout } = cp.spawn('./dist/reg-utils', ['browser'], { stdio: ['ignore', 'pipe', 'inherit'] })
        const text = await new Response(stream.Readable.toWeb(stdout) as any).text()
        if (!text) { throw null }
        const data = parse(text)
        const browsers: NonNullable<Config['browsers']> = { __proto__: null! }
        for (const key of keys(data)) {
          if (key[0] === '$') { continue }
          const { name, words } = data[key]
          browsers[key] = { name, args: words }
        }
        config.browsers = browsers
        config.defaultBrowser = data.$default
      } catch (e) {
        config.browsers = {}
        if (e != null) { error(e) }
      } finally {
        await writeConfig(config)
      }
    }
  }
}