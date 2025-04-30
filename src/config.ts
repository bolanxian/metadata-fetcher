
import { assign, keys } from 'bind:Object'
import { ready as ready1, getCache, setCache } from './cache'
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
  batch: Record<string, string>
}
export const config: Config = {
  browsers: null,
  defaultBrowser: null,
  separator: '\uFF0F',
  template: `\
title=标题：
ownerName=UP主：
publishDate=日期：
shortUrl=链接：
thumbnailUrl=封面：
description=简介：
`,
  batch: {
    '.id': '[${rawId}]${url}',
    list: '${title}${_}${rawId}${_}${ownerName}',
    name: '[${ownerName}][${id}]${title}',
    escape: '［${rawId|escape}］${title}',
  }
}

export const readConfig = async () => {
  if (SSR || PAGES) {
    const data = await getCache(configName)
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
    await setCache(configName, stringify(_config))
    assign(config, _config)
  }
  return true
}

export const ready = SSR || PAGES ? (async () => {
  await ready1
  await readConfig()
  if (SSR) {
    if (config.browsers == null) {
      try {
        const cp = await import('node:child_process')
        const stream = await import('node:stream')
        const { stdout } = cp.spawn('./dist/reg-utils', ['browser'], { stdio: ['ignore', 'pipe', 'inherit'] })
        const data = await new Response(stream.Readable.toWeb(stdout) as any).json()
        const browsers: NonNullable<Config['browsers']> = { __proto__: null! }
        for (const key of keys(data)) {
          if (key[0] === '$') { continue }
          const { name, words } = data[key]
          browsers[key] = { name, args: words }
        }
        config.browsers = browsers
        config.defaultBrowser = data.$default
        await writeConfig(config)
      } catch (e) { error(e) }
    }
  }
})() : null!