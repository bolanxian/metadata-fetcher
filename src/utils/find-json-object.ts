
import type { CheerioAPI } from 'cheerio'
import { match } from 'bind:utils'
import { charCodeAt, indexOf, slice } from 'bind:String'

const BACKSLASH = 0x5c   // \
const QUOTE = 0x22        // "
const OPEN_BRACE = 0x7b   // {
const CLOSE_BRACE = 0x7d  // }

/**
 * 从 `text` 中第一个 `{` 开始，用 brace 计数定位与之匹配的最外层 `}`，
 * 并返回该 JSON 片段（含两端大括号）。
 *
 * 扫描过程中跟踪双引号字符串字面量，并跳过反斜杠转义，
 * 使字符串内部的 `{` `}` 不影响计数。单次线性扫描，时间复杂度 O(n)。
 */
export const find = (text: string) => {
  const start = indexOf(text, '{')
  if (!(start >= 0)) { return }
  let depth = 0
  let inString = false
  let i = start
  const len = text.length
  while (i < len) {
    const c = charCodeAt(text, i)
    if (inString) {
      if (c === BACKSLASH) {
        i += 2
        continue
      }
      if (c === QUOTE) {
        inString = false
      }
      i += 1
      continue
    }
    if (c === QUOTE) {
      inString = true
    } else if (c === OPEN_BRACE) {
      depth++
    } else if (c === CLOSE_BRACE) {
      depth--
      if (depth === 0) {
        return slice(text, start, i + 1)
      }
    }
    i += 1
  }
  return
}

const $parse = JSON.parse
export const fromHTML = ($: CheerioAPI, reg: RegExp) => {
  for (const el of $('script:not([src])')) {
    let text = $(el).text(), m, json
    if ((m = match(reg, text)) != null) {
      text = slice(text, m.index! + m[0].length)
      if ((json = find(text)) != null) {
        return $parse(json)
      }
    }
  }
}
