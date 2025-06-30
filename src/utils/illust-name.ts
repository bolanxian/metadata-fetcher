import { match } from 'bind:utils'
import { replace } from 'bind:String'
import { type BatchResult, renderBatch } from '../plugin'

type Plugin = [
  RegExp, (m: RegExpMatchArray) => string,
  (name: string, id: string, m: RegExpMatchArray) => string
]
const plugins: Plugin[] = [
  [/^(?:[^A-Za-z]*im)?(\d+)\.(\w+)$/, m => `im${m[1]}`, (name, id, m) => {
    return `${name}.${m[2]}`
  }],
  [/^(\d+)_p(\d+)([^]+)$/, m => `pixiv!${m[1]}`, (name, id, m) => {
    name = replace(name, id, `${id}-${m[2]}`)
    return `${name}${m[3]}`
  }]
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
      for await (result of renderBatch([id], 'name')) { break }
      const name = result?.error === null ? result.value : `[${id}]`
      const filename = $[2](name, id, m)
      return filename
    }
  }
}