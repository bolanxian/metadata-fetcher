
export const name = 'metadata-fetcher'
export const inject = ['database']

import { getOwn } from 'bind:utils'
import { Context, Field, Schema, Session, Tables, h } from 'koishi'
import { LRUCache } from 'lru-cache'
import { join } from './bind'
import type { ResolvedInfo, ParsedInfo } from './meta-fetch/mod'
import { init, NoCache, xparse } from './meta-fetch/mod'
import {/*init as initConfig,*/config as defaultConfig } from './config'
import { render, renderLine } from './render'
const ready = (async () => {
  init({ cache: new NoCache(), fetch })
  // await initConfig()
})()

export interface Config {
  separator: string
  template: string
}
export const Config: Schema<Config> = Schema.object({
  separator: Schema.string().default(defaultConfig.separator),
  template: Schema.string().default(defaultConfig.template),
})

const locale_zh_Hans = {
  commands: {
    meta: {
      description: '获取元数据', messages: {
        unknown: '未知的输入',
        fail: '获取失败'
      }
    },
    'meta.img': { description: '获取封面' },
    'meta.list': { description: '生成借物表' },
    'meta.name': { description: '生成文件名' }
  }
}
const UNKNOWN = 'commands.meta.messages.unknown'
const FAIL = 'commands.meta.messages.fail'

declare module 'koishi' {
  interface Tables {
    [name]: Omit<ParsedInfo, 'shortUrl' | 'url'> & { id: string }
  }
}
const fields: Field.Extension<Tables[typeof name]> = {
  id: 'string',
  title: 'string',
  ownerName: 'string',
  publishDate: 'string',
  thumbnailUrl: 'string',
  relatedUrl: 'string',
  keywords: 'string',
  description: 'text'
}

const cache: LRUCache<string, ParsedInfo, { context: Context, resolved: ResolvedInfo }> = new LRUCache({
  max: 20,
  async fetchMethod(id, staleValue, { signal, context: { context: ctx, resolved } }) {
    const [_parsed]: Tables[typeof name][] = await ctx.database.get(name, { id })
    if (_parsed != null) {
      const { shortUrl, url } = resolved
      return { ..._parsed, id: void 0, shortUrl, url }
    }
    const [, , redirectedPromise, , parsedPromise] = xparse(id)
    if (redirectedPromise != null) {
      const resolved = await redirectedPromise
      if (resolved != null) {
        return await cache.fetch(resolved.id, { context: { context: ctx, resolved } })
      }
      return
    }
    const parsed = await parsedPromise
    if (parsed != null) {
      const { title, ownerName, publishDate, thumbnailUrl, relatedUrl, keywords, description } = parsed
      await ctx.database.create(name, {
        id, title, ownerName, publishDate, thumbnailUrl, relatedUrl, keywords, description
      })
      return parsed
    }
  }
})
const empty = Promise.resolve(Object.freeze([] as []))
const parse = async (ctx: Context, input: string): Promise<readonly [ResolvedInfo?, ParsedInfo?]> => {
  const [, resolved] = xparse(input)
  if (resolved == null) { return empty }
  const parsed = await cache.fetch(resolved.id, { context: { context: ctx, resolved } })
  return [resolved, parsed]
}
async function* renderList(
  ctx: Context, session: Session,
  separator: string, args: string[], key: string
) {
  const batch = getOwn(defaultConfig.batch, key)!
  const sep = { separator, _: separator }
  for (const arg of args) {
    const [resolved, parsed] = await parse(ctx, arg)
    if (resolved == null) {
      yield `${session.text(UNKNOWN)} : ${arg}`
      continue
    }
    if (parsed == null) {
      yield `${session.text(FAIL)} : ${arg}`
      continue
    }
    const data = { ...sep, ...resolved, ...parsed }
    yield renderLine(data, batch.template)
  }
}

export const apply = (ctx: Context, config: Config) => {
  ctx.on('ready', () => ready)
  ctx.i18n.define('zh-Hans', locale_zh_Hans)
  ctx.i18n.define('zh-CN', locale_zh_Hans)
  ctx.model.extend(name, fields)

  ctx.command('meta <input>').action(async ({ session }, input) => {
    const [resolved, parsed] = await parse(ctx, input)
    if (resolved == null) { return session!.text(UNKNOWN) }
    if (parsed == null) { return session!.text(FAIL) }
    return render(parsed, config.template)
  })
  ctx.command('meta.img <input>').action(async ({ session }, input) => {
    const [resolved, parsed] = await parse(ctx, input)
    if (resolved == null) { return session!.text(UNKNOWN) }
    const image = parsed?.thumbnailUrl
    if (image == null) { return session!.text(FAIL) }
    return h.image(image)
  })
  for (const command of ['list', 'name']) {
    ctx.command(`meta.${command} [...args]`).action(async ({ session }, ...args) => {
      const ret = []
      for await (const arg of renderList(ctx, session!, config.separator, args, command)) {
        ret[ret.length] = arg
      }
      return join(ret, '\n')
    })
  }
  ctx.command('meta.keys', { hidden: true } as any).action(() => {
    return join(cache.keys(), ' ') || '列表为空'
  })
}
