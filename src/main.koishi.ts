
export const name = 'metadata-fetcher'
export const inject = ['database']

import { getOwn } from 'bind:utils'
import type { Session, Tables, Context, Field } from 'koishi'
import { Schema, h } from 'koishi'
import { LRUCache } from 'lru-cache'
import { join } from './bind'
import type { ResolvedInfo, ParsedInfo } from './meta-fetch/mod'
import { init, NoCache, resolve, tryRedirect, parse } from './meta-fetch/mod'
import { config as defaultConfig } from './config'
import { render, renderLine } from './render'
const ready = (async () => {
  init({ cache: new NoCache(), fetch })
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
        too_many_redirects: '重定向过多',
        redirect_fail: '重定向失败',
        fail: '获取失败'
      }
    },
    'meta.img': { description: '获取封面' },
    'meta.list': { description: '生成借物表' },
    'meta.name': { description: '生成文件名' }
  }
}
const UNKNOWN = 'commands.meta.messages.unknown'
const TOO_MANY_REDIRECTS = 'commands.meta.messages.too_many_redirects'
const REDIRECT_FAIL = 'commands.meta.messages.redirect_fail'
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

const cache: LRUCache<string, ResolvedInfo & ParsedInfo, { context: Context, resolved: ResolvedInfo }> = new LRUCache({
  max: 20,
  async fetchMethod(cacheId, staleValue, { signal, context: { context: ctx, resolved } }) {
    const [_parsed]: Tables[typeof name][] = await ctx.database.get(name, { id: cacheId })
    if (_parsed != null) {
      return { ..._parsed, ...resolved }
    }
    const parsed = await parse(resolved)
    if (parsed != null) {
      const { title, ownerName, publishDate, thumbnailUrl, relatedUrl, keywords, description } = parsed
      await ctx.database.create(name, {
        id: cacheId, title, ownerName, publishDate, thumbnailUrl, relatedUrl, keywords, description
      })
      return parsed
    }
  }
})

type RedirectStatus = 'too-many' | 'fail' | null
const fetchInfo = async (ctx: Context, input: string): Promise<{
  resolved: ResolvedInfo | null
  redirectList: ResolvedInfo[]
  redirectStatus: RedirectStatus
  parsed: ResolvedInfo & ParsedInfo | undefined
}> => {
  let resolved: ResolvedInfo | null
  const redirectList: ResolvedInfo[] = []
  let redirectStatus: RedirectStatus = null
  let parsed: ResolvedInfo & ParsedInfo | undefined
  redirect: while (true) {
    resolved = resolve(input)
    if (resolved == null) { break redirect }
    if (!resolved.cacheId) { break redirect }
    const redirectedPromise = tryRedirect(resolved)
    if (redirectedPromise != null) {
      const redirected = await redirectedPromise
      if (redirected != null) {
        input = redirected.url
        if (redirectList.length < 5) {
          redirectList[redirectList.length] = redirected
          continue redirect
        }
        redirectStatus = 'too-many'
        break redirect
      }
      redirectStatus = 'fail'
      break redirect
    }
    parsed = await cache.fetch(resolved.cacheId, { context: { context: ctx, resolved } })
    break redirect
  }
  return { resolved, redirectList, redirectStatus, parsed }
}
async function* renderList(
  ctx: Context, session: Session,
  separator: string, args: string[], key: string
) {
  const batch = getOwn(defaultConfig.batch, key)!
  const sep = { separator, _: separator }
  for (const arg of args) {
    const { resolved, redirectStatus, parsed } = await fetchInfo(ctx, arg)
    if (resolved == null) {
      yield `${session.text(UNKNOWN)} : ${arg}`
      continue
    }
    if (parsed == null) {
      let text: string
      switch (redirectStatus) {
        case 'too-many': text = session!.text(TOO_MANY_REDIRECTS); break
        case 'fail': text = session!.text(REDIRECT_FAIL); break
      }
      text ??= session!.text(FAIL)
      yield `${text} : ${arg}`
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
    const { resolved, redirectStatus, parsed } = await fetchInfo(ctx, input)
    if (resolved == null) { return session!.text(UNKNOWN) }
    if (parsed == null) {
      switch (redirectStatus) {
        case 'too-many': return session!.text(TOO_MANY_REDIRECTS)
        case 'fail': return session!.text(REDIRECT_FAIL)
      }
      return session!.text(FAIL)
    }
    return render(parsed, config.template)
  })
  ctx.command('meta.img <input>').action(async ({ session }, input) => {
    const { resolved, parsed } = await fetchInfo(ctx, input)
    if (resolved == null) { return session!.text(UNKNOWN) }
    const image = getOwn(parsed!, 'thumbnailUrl')
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
