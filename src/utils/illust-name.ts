import { match } from 'bind:utils'
import { type BatchResult, type OnParsed, renderBatch } from '@/render'
const PAGE_COUNT = Symbol.for('meta-fetch:pixiv-pageCount')
type Parsed = Parameters<OnParsed>[0] & { [PAGE_COUNT]: any }

type Plugin = [
  RegExp, (m: RegExpMatchArray) => string,
  ((parsed: Parsed, m: RegExpMatchArray) => void) | null,
  (name: string, m: RegExpMatchArray) => string
]
const plugins: Plugin[] = [
  [/^(?:[^A-Za-z]*im)?(\d+)\.(\w+)$/, m => `im${m[1]}`, null, (name, m) => `${name}.${m[2]}`],
  [/^(\d+)_p((?!0\d)\d+)([^]+)$/, m => `pixiv!${m[1]}-${m[2]}`, (parsed, m) => {
    if (+parsed[PAGE_COUNT] === 1 && m[2] === '0') {
      parsed.id = `pixiv!${m[1]}`
      parsed.displayId = `pixiv:${m[1]}`
    }
  }, (name, m) => `${name}${m[3]}`]
]
export const illustId = (line: string) => {
  for (const $ of plugins) {
    let m: RegExpMatchArray | null
    if ((m = match($[0], line)) != null) {
      const id = $[1](m)
      return id
    }
  }
}
export const illustName = async (line: string) => {
  for (const $ of plugins) {
    let m: RegExpMatchArray | null
    if ((m = match($[0], line)) != null) {
      const id = $[1](m)
      let result: BatchResult | undefined
      const onParsed: OnParsed = (parsed) => { $[2]?.(parsed as Parsed, m!) }
      for await (result of renderBatch([id], 'name', onParsed)) { break }
      const name = result?.error === null ? result.value : `[${id}]`
      const filename = $[3](name, m)
      return filename
    }
  }
}