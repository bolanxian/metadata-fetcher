
export const name = 'metadata-fetcher'
export const inject = ['database']

import { getOwn } from 'bind:utils'
import { split } from 'bind:String'
import type { Session, Tables, Context, Field, Fragment } from 'koishi'
import { Schema, h } from 'koishi'
import { LRUCache } from 'lru-cache'
import { empty, join, onlyFirst32, controlCharToSpace } from '@/bind'
import { ready as readyTemporal } from '@/utils/temporal'
import type { Config as MetaFetchConfig, ResolvedInfo, ParsedInfo } from '@/meta-fetch/mod'
import { init, config as metaFetchConfig, NoCache, resolve, tryRedirect, parse } from '@/meta-fetch/mod'
import { config as defaultConfig } from '@/config'
import { render, renderLine } from '@/render'
const ready = (async () => {
  init({ cache: new NoCache(), fetch })
  await readyTemporal
})()

export interface Config extends MetaFetchConfig {
  separator: string
  template: string[]
  qqCard: boolean
}
export const Config: Schema<Config> = Schema.object({
  separator: Schema.string()
    .default(defaultConfig.separator)
    .description('借物表的分隔符'),
  template: Schema.array(Schema.string().required()).role('table')
    .default(split(defaultConfig.template, '\n'))
    .description('元数据模板'),
  qqCard: Schema.boolean().default(true).description('是否匹配QQ卡片消息'),
  nicoUrlType: Schema.union([
    Schema.const('watch').description('默认'),
    Schema.const('tree').description('ニコニ･コモンズ'),
  ]).default('tree').role('radio')
    .description('Niconico 链接'),
  hostOfJmcomic: Schema.string(),
})

const locale_zh_Hans = {
  commands: {
    meta: {
      description: '获取元数据', messages: {
        unsupported_platform: '不支持的平台',
        unknown: '未知的输入',
        too_many_redirects: '重定向过多',
        redirect_fail: '重定向失败',
        fail: '获取失败',
      }
    },
    'meta.card': { description: '生成卡片消息' },
    'meta.img': { description: '获取封面' },
    'meta.list': { description: '生成借物表' },
    'meta.name': { description: '生成文件名' }
  }
}
const UNSUPPORTED_PLATFORM = 'commands.meta.messages.unsupported_platform'
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
  redirectList: string[]
  redirectStatus: RedirectStatus
  lastRedirect: string | null
  parsed: ResolvedInfo & ParsedInfo | undefined
}> => {
  let resolved: ResolvedInfo | null
  const redirectList: string[] = []
  let redirectStatus: RedirectStatus = null
  let lastRedirect: string | null = null
  let parsed: ResolvedInfo & ParsedInfo | undefined
  redirect: while (true) {
    resolved = resolve(input)
    if (resolved == null) { break redirect }
    if (!resolved.cacheId) { break redirect }
    const redirectedPromise = tryRedirect(resolved)
    if (redirectedPromise != null) {
      const redirected = await redirectedPromise
      if (redirected == null) {
        redirectStatus = 'fail'
        break redirect
      }
      input = redirected
      lastRedirect = redirected
      redirectList[redirectList.length] = redirected
      if (!(redirectList.length <= 5)) {
        redirectStatus = 'too-many'
        break redirect
      }
      continue redirect
    }
    parsed = await cache.fetch(resolved.cacheId, { context: { context: ctx, resolved } })
    break redirect
  }
  return { resolved, redirectList, redirectStatus, lastRedirect, parsed }
}
async function* renderList(
  ctx: Context, session: Session,
  separator: string, args: string[], key: string
): AsyncGenerator<string, void, void> {
  const batch = getOwn(defaultConfig.batch, key)!
  const sep = { separator, _: separator }
  for (const arg of args) {
    const { resolved, redirectStatus, lastRedirect, parsed } = await fetchInfo(ctx, arg)
    if (resolved == null) {
      yield `${session.text(UNKNOWN)}: ${lastRedirect ?? arg}`
      continue
    }
    if (parsed == null) {
      let msg: string
      switch (redirectStatus) {
        case 'too-many': msg = session!.text(TOO_MANY_REDIRECTS); break
        case 'fail': msg = session!.text(REDIRECT_FAIL); break
        default: msg = session!.text(FAIL); break
      }
      yield `${msg}: ${lastRedirect ?? arg}`
      continue
    }
    const data = { ...sep, ...resolved, ...parsed }
    yield renderLine(data, batch.template)
  }
}
const findJsonCard = (elements: readonly h[]): string | undefined => {
  for (const { type, attrs } of elements) {
    if (type === 'json' || type === 'onebot:json') {
      const rawData = attrs['data']
      if (rawData != null) {
        const data = JSON.parse(rawData)
        switch (data?.app) {
          case 'com.tencent.tuwen.lua':
            return data?.meta?.news?.jumpUrl
          case 'com.tencent.miniapp_01':
            return data?.meta?.detail_1?.qqdocurl
        }
      }
    }
  }
}

export const apply = (ctx: Context, config: Config) => {
  type Result = Promise<Exclude<Fragment, string>>

  ctx.on('ready', () => ready)
  ctx.i18n.define('zh-Hans', locale_zh_Hans)
  ctx.i18n.define('zh-CN', locale_zh_Hans)
  ctx.model.extend(name, fields)

  metaFetchConfig.nicoUrlType = config.nicoUrlType
  metaFetchConfig.hostOfJmcomic = config.hostOfJmcomic || null

  config.qqCard && ctx.middleware(async (session, next) => {
    if (session.bot.platform !== 'onebot') { return next() }
    try {
      const { elements } = session
      const url = findJsonCard(elements ?? empty)
      if (url != null) {
        const { parsed } = await fetchInfo(ctx, url)
        if (parsed != null) {
          return [render(parsed, join(config.template, '\n'))]
        }
      }
    } catch (e) {
      ctx.logger.error(e)
    }
    return next()
  })

  ctx.command('meta <input>').action(async ({ session }, input): Result => {
    const { resolved, redirectStatus, lastRedirect, parsed } = await fetchInfo(ctx, input)
    let msg: string | undefined
    if (resolved == null) {
      msg = session!.text(UNKNOWN)
    } else if (parsed == null) {
      switch (redirectStatus) {
        case 'too-many': msg = session!.text(TOO_MANY_REDIRECTS); break
        case 'fail': msg = session!.text(REDIRECT_FAIL); break
        default: msg = session!.text(FAIL); break
      }
    } else {
      return [render(parsed, join(config.template, '\n'))]
    }
    return [`${msg}${lastRedirect != null ? `: ${lastRedirect}` : ''}`]
  })
  ctx.command('meta.img <input>').action(async ({ session }, input): Result => {
    const { parsed } = await fetchInfo(ctx, input)
    if (parsed == null) { return [session!.text(UNKNOWN)] }
    const image = getOwn(parsed, 'thumbnailUrl')
    if (image == null) { return [session!.text(FAIL)] }
    return h.image(image)
  })
  ctx.command('meta.card <input>')
    .option('title', '-t <title:string>')
    .option('desc', '-d <description:string>')
    .option('thumb', '-c <thumbnailUrl:string>')
    // .option('music', '-m')
    .action(async ({ session, options }, input): Result => {
      const { bot } = session!
      if (bot.platform !== 'onebot') {
        return [session!.text(UNSUPPORTED_PLATFORM), ' ', bot.platform!]
      }
      const { parsed } = await fetchInfo(ctx, input)
      if (parsed == null) { return [session!.text(UNKNOWN)] }
      const { url } = parsed
      let title: string = options?.title ?? parsed.title
      title = onlyFirst32(title)
      title = controlCharToSpace(title)
      let content: string = options?.desc ?? parsed.description ?? parsed.url
      content = onlyFirst32(content)
      content = controlCharToSpace(content)
      return h('onebot:music', {
        type: 'custom', url, audio: url, title, content,
        image: options?.thumb ?? parsed.thumbnailUrl ?? '',
      })
    })
  for (const command of ['list', 'name']) {
    ctx.command(`meta.${command} [...args]`).action(async ({ session }, ...args): Result => {
      let result = ''
      for await (const line of renderList(ctx, session!, config.separator, args, command)) {
        result += line
        result += '\n'
      }
      return [result]
    })
  }

  ctx.command('meta.keys', { ['hidden' as never]: true }).action((): Awaited<Result> => {
    return [join(cache.keys(), ' ') || '列表为空']
  })
}
