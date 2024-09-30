
export const name = 'metadata-fetcher'
export const inject = ['database']

import { Context, Field, Schema, Session, Tables, h } from 'koishi'
import type { ResolvedInfo, ParsedInfo, Render } from './plugin'
import { xparse, defaultTemplate, render, getSeparator, renderListNameRender, renderListDefaultRender } from './plugin'
import.meta.glob('./plugins/*', { eager: true })

export interface Config {
  template: string
}
export const Config: Schema<Config> = Schema.object({
  template: Schema.string().default(defaultTemplate)
})

const locale_zh_Hans = {
  commands: {
    meta: {
      description: '获取元数据', messages: {
        unknown: '未知的输入'
      }
    },
    'meta.img': { description: '获取封面' },
    'meta.list': { description: '生成借物表' },
    'meta.name': { description: '生成文件名' }
  }
}
const UNKNOWN = 'commands.meta.messages.unknown'

declare module 'koishi' {
  interface Tables {
    [name]: ParsedInfo & { id: string }
  }
}
const fields: Field.Extension<Tables[typeof name]> = {
  id: 'string',
  title: 'string',
  ownerName: 'string',
  publishDate: 'string',
  shortUrl: 'string',
  url: 'string',
  thumbnailUrl: 'string',
  keywords: 'string',
  description: 'text'
}

const empty = Promise.resolve(Object.freeze([] as []))
const map = new Map<string, Promise<[ResolvedInfo?, ParsedInfo?]>>()
const request = async (ctx: Context, id: string, resolved: ResolvedInfo): Promise<[ResolvedInfo, ParsedInfo]> => {
  try {
    let [parsed]: ParsedInfo[] = await ctx.database.get(name, { id })
    if (parsed == null) {
      const [, , , , parsedPromise] = xparse(id)
      parsed = (await parsedPromise)!
      if (parsed != null) {
        const { title, ownerName, publishDate, shortUrl, url, thumbnailUrl, keywords = '', description } = parsed
        await ctx.database.create(name, {
          id, title, ownerName, publishDate, shortUrl, url, thumbnailUrl, keywords, description
        })
      }
    }
    return [resolved, parsed]
  } finally {
    map.delete(id)
  }
}
const parse = (ctx: Context, input: string): Promise<readonly [ResolvedInfo?, ParsedInfo?]> => {
  const [, resolved] = xparse(input)
  if (resolved == null) { return empty }
  const { id } = resolved
  if (map.has(id)) { return map.get(id)! }
  const promise = request(ctx, id, resolved)
  map.set(id, promise)
  return promise
}
async function* renderList(
  ctx: Context, template: string,
  session: Session, args: string[],
  render = renderListDefaultRender
) {
  const _ = getSeparator(template)
  for (const arg of args) {
    const [resolved, parsed] = await parse(ctx, arg)
    if (parsed == null) {
      yield `${session.text(UNKNOWN)} : ${arg}`
      continue
    }
    yield render(_, resolved!, parsed)
  }
}

export const apply = (ctx: Context, config: Config) => {
  ctx.i18n.define('zh-Hans', locale_zh_Hans)
  ctx.i18n.define('zh-CN', locale_zh_Hans)
  ctx.model.extend(name, fields)

  ctx.command('meta <arg0>').action(async ({ session }, arg0) => {
    const [, parsed] = await parse(ctx, arg0)
    if (parsed == null) { return session!.text(UNKNOWN) }
    return render(parsed, config.template)
  })
  ctx.command('meta.img <arg0>').action(async ({ session }, arg0) => {
    const [, parsed] = await parse(ctx, arg0)
    if (parsed == null) { return session!.text(UNKNOWN) }
    return h.image(parsed.thumbnailUrl)
  })
  for (const [command, render] of [
    ['list', renderListDefaultRender],
    ['name', renderListNameRender]
  ] as [string, Render][]) {
    ctx.command(`meta.${command} [...args]`).action(async ({ session }, ...args) => {
      let ret = ''
      for await (const arg of renderList(ctx, config.template, session!, args, render)) { ret += `${arg}\n` }
      return ret
    })
  }
  ctx.command('meta.keys', { hidden: true } as any).action(() => {
    return JSON.stringify([...map.keys()])
  })
}
