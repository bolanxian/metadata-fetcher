
import { getOwn, replace } from 'bind:utils'
import { includes, trim, split, indexOf, slice } from 'bind:String'
import { charToFullwidth, controlCharToPicture } from './bind'
import { config } from './config'
import { type ParsedInfo, resolve, parse, xparse } from '@/meta-fetch/mod'

export type Result<T, E extends {}> = { error: E, cause?: any } | { error: null, value: T }
export type BatchResult = Result<string, string>

export const render = <K extends string>(data: { [_ in K]?: string }, template = config.template) => {
  let ret = ''
  for (const line of split(template, '\n')) {
    const i = indexOf(line, '=')
    if (!(i > 0)) { continue }
    let prefix = trim(slice(line, i + 1))
    if (prefix[0] === '"') { prefix = JSON.parse(prefix) }
    for (const key of split(slice(line, 0, i), '||')) {
      let value = getOwn(data, trim(key))
      if (value) {
        ret += `${prefix}${value}\n`
        break
      }
    }
  }
  return ret
}

const REG_LINE = /\$\{(.+?)\}/g
export const renderLine = (data: Record<string, string>, template: string) => {
  return replace(REG_LINE, template, ($0, $1) => {
    let val: string | undefined
    if (includes($1, '|')) {
      const [name, ...args] = split($1, '|')
      val = getOwn(data, trim(name))
      if (val != null) {
        for (const arg of args) {
          const fn: (str: string) => string = getOwn(renderLine, trim(arg))!
          val = fn(val)
        }
      }
    } else {
      val = getOwn(data, trim($1))
    }
    if (val == null) { return '' }
    return controlCharToPicture(val)
  })
}
renderLine.escape = (str: string) => replace(/(?<=^(?=av)|^a(?=v)|^(?=BV)|^B(?=V))./g, str, charToFullwidth)
renderLine.filename = (str: string) => replace(/[\\/:*?"<>|]/g, str, charToFullwidth)

export const renderBatchSingle = (
  arg: string, template: string, sep: Record<string, string>,
): BatchResult => {
  let data: Record<string, string>
  const resolved = resolve(arg)
  if (resolved == null) { return { error: `Unknown Input : ${arg}` } }
  data = { ...sep, ...resolved }
  return { error: null, value: renderLine(data, template) }
}
export const renderBatchSingleWithParse = async (
  arg: string, template: string, sep: Record<string, string>,
  onParsed?: (parsed: ParsedInfo) => void
): Promise<BatchResult> => {
  let data: Record<string, string>
  let [, resolved, redirected, , parsedPromise] = xparse(arg)
  if (resolved == null) { return { error: `Unknown Input : ${arg}` } }
  if (redirected != null) {
    if ((resolved = (await redirected)!) != null) {
      parsedPromise = parse(resolved)
    } else {
      return { error: `Redirect Failed : ${arg}` }
    }
  }
  let parsed: ParsedInfo | null | undefined, cause: any
  try { parsed = await parsedPromise } catch (e) { cause = e }
  if (parsed == null) { return { error: `Not Found : ${resolved.id}`, cause } }
  onParsed?.(parsed)
  data = { ...sep, ...resolved, ...parsed }
  return { error: null, value: renderLine(data, template) }
}
export async function* renderBatch(
  args: string[], key: string, onParsed?: (parsed: ParsedInfo) => void
): AsyncGenerator<BatchResult> {
  const batch = getOwn(config.batch, key)
  if (batch == null) { yield { error: `Unknown Template : ${key}` }; return }
  const { separator } = config, { template } = batch
  const sep = { separator, _: separator }
  const withParse = key[0] !== '.'
  const single = withParse ? renderBatchSingleWithParse : renderBatchSingle
  for (const arg of args) {
    yield single(arg, template, sep, onParsed)
  }
}
