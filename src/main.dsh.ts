
export const name = 'metadata-fetcher'
export const inject = ['llm']

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { LlmAdapter, type GenerateOptions, type LlmModelInfo, type Message, type StreamChunk } from '@deepseek-ai/dsh-llm'

import { match } from 'bind:utils'
import { replaceAll } from 'bind:String'
import { resolve, xparse, init, NoCache, getDiscoverGlobalRegExp, } from '@/meta-fetch/mod'
import { render as _render } from '@/render'
init({ cache: new NoCache(), fetch })

const appName = 'MetadataFetcher'

export interface Config {
  /** 模型选择器中的提供者 */
  provider: string
  /** 模型选择器中的模型名 */
  model: string
}

export const Config: Schema<Config> = Schema.object({
  provider: Schema.string().default(appName).description('模型选择器中的提供者'),
  model: Schema.string().default(appName).description('模型选择器中的模型名'),
})

class MetadataFetcher extends LlmAdapter {
  constructor(public config: Config) {
    super()
  }
  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const name = this.config.model
    return [{ provider, id: name, name }]
  }
  stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    let msg = lastUserMsg(options)
    let streamFn = stream
    if (msg == null) {
      msg = lastUserMsg(options, 'dsh-session-title-llm' as any)
      if (msg == null) {
        return echo('(空输入)')
      }
      streamFn = streamTitle
    }
    const text = getText(msg)
    return streamFn(text)
  }
}

const lastUserMsg = (options: GenerateOptions, kind: Message['source']['kind'] = 'user'): Message | undefined => {
  const messages = options.messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg == null || msg.source == null) continue
    if (msg.role !== 'user') continue
    if (msg.source.kind !== kind) continue
    return msg
  }
}
const getText = (message: Message): string => {
  let result = ''
  for (const part of message.content) {
    if (part.type === 'text') {
      result += part.text
    }
  }
  return result
}

async function* render(arg: string) {
  let redirectCount = 0
  let msg: string | null = `输入：${arg}`
  redirect: while (true) {
    const [, resolved, redirectedPromise, , parsedPromise] = xparse(arg)
    if (resolved == null) { return }
    if (redirectedPromise != null) {
      if (msg != null) { yield msg; msg = null }
      const redirected = await redirectedPromise
      if (redirected != null) {
        arg = redirected.url
        if (redirectCount < 5) {
          yield `跳转：${arg}`
          redirectCount++
          continue redirect
        }
        yield `跳转次数过多：${arg}`
        return
      }
      yield `跳转失败：${resolved.id}`
      return
    }
    const parsed = await parsedPromise
    yield parsed != null
      ? _render(parsed)
      : `失败：${resolved.id}`
    return
  }
}

async function* echo(text: string): AsyncGenerator<StreamChunk> {
  yield { type: 'block-start', index: 0, blockType: 'text' }
  yield { type: 'block-end', index: 0, block: { type: 'text', text }, }
  yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } }
  yield { type: 'finish', reason: { kind: 'stop' } }
}
async function* streamTitle(text: string): AsyncGenerator<StreamChunk> {
  let firstId: string | undefined, count = 0
  for (const id of match(getDiscoverGlobalRegExp(), text) ?? []) {
    let newId = resolve(id)?.id
    if (newId != null) { firstId ??= newId; count++ }
  }
  const result = firstId != null ? `${firstId} 等 ${count} 项` : '未知'

  yield { type: 'block-start', index: 0, blockType: 'text' }
  yield { type: 'block-end', index: 0, block: { type: 'text', text: result }, }
  yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } }
  yield { type: 'finish', reason: { kind: 'stop' } }
}
async function* stream(text: string): AsyncGenerator<StreamChunk> {
  yield { type: 'block-start', index: 0, blockType: 'text' }
  let result = ''
  try {
    for (const id of match(getDiscoverGlobalRegExp(), text) ?? []) {
      for await (const message of render(id)) {
        const msg = `${replaceAll(message, '\n', '  \n')}  \n`
        result += msg
        yield { type: 'text-delta', index: 0, text: msg }
      }
    }
  } catch (error: any) {
    const msg = `错误：${error?.message}  \n`
    result += msg
    yield { type: 'text-delta', index: 0, text: msg }
    console.error(error)
  }
  result ||= '未知的输入'
  yield { type: 'block-end', index: 0, block: { type: 'text', text: result } }
  yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } }
  yield { type: 'finish', reason: { kind: 'stop' } }
}

export function apply(ctx: Context, config: Config) {
  const adapter = new MetadataFetcher(config)
  ctx.llm.registerAdapter([config.provider], adapter)
}
