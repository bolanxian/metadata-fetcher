
import { CheerioAPI } from 'cheerio'
import { $string, match, replace } from '../bind'
const { trim, indexOf, slice, repeat } = $string

const REG1 = /".*?(?<!\\)"/sg
const REG2 = /(?<!^){[^{}]*?}/g
let replaced = false
const REG_CB = (m: string) => {
  replaced = true
  return repeat(' ', m.length)
}

export const find = (text: string) => {
  let i = indexOf(text, '{')
  if (!(i >= 0)) { return }
  text = slice(text, i)
  let _ = replace(REG1, text, REG_CB)
  do {
    replaced = false
    _ = replace(REG2, _, REG_CB)
  } while (replaced)
  i = indexOf(_, '}')
  if (!(i > 0)) { return }
  return slice(text, 0, i + 1)
}

const $parse = JSON.parse
export const fromHTML = ($: CheerioAPI, reg: RegExp) => {
  for (const el of $('script:not([src])')) {
    let text = trim($(el).text()), m, json
    if ((m = match(reg, text)) != null) {
      text = slice(text, m.index! + m[0].length)
      if ((json = find(text)) != null) {
        return $parse(json)
      }
    }
  }
}
