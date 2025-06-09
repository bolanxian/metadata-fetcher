
//@ts-ignore
export { default as $string } from 'bind:String'
//@ts-ignore
export { default as $array } from 'bind:Array'
import { replace } from 'bind:utils'
import { fromCharCode, charCodeAt, slice, startsWith, trim } from 'bind:String'
import * as cheerio from 'cheerio'

export const noop = () => { }
export const nextTick = queueMicrotask

export const iterator: typeof Symbol.iterator = Symbol.iterator
export const join = (iter: Iterable<any>, separator = ',') => {
  iter = iter[iterator]() as any
  for (let ret of iter as Iterable<string>) {
    for (const value of iter) {
      ret = `${ret}${separator}${value}`
    }
    return ret
  }
  return ''
}
/** [\x21-\x7E] to [\uFF01-\uFF5E] */
export const charToFullwidth = ($0: string) => fromCharCode(charCodeAt($0, 0) + 0xFEE0)
const REG_NOT_FIRST_32 = /(?<=^.{32}).+$/su
export const onlyFirst32 = (input: string, ellipsis = '…') => replace(REG_NOT_FIRST_32, input, ellipsis)
const REG_LAST = /.$/su
export const removeLast = (input: string) => replace(REG_LAST, input, '')
export const controlCharToPicture = (str: string) => replace(/[\x00-\x1F\x7F]/g, str, $0 => {
  return $0 === '\x7F' ? '\u2421' : fromCharCode(charCodeAt($0, 0) + 0x2400)
})
export const toHttps = (input: string) => {
  input = trim(input)
  if (startsWith(input, 'http:')) {
    input = `https:${slice(input, 5)}`
  }
  return input
}

const createEscaper = (reg: RegExp, map: Record<string, string>) => {
  const cb = (sub: string) => map[sub] ?? ''
  return (input: string) => replace(reg, input, cb)
}
const escapeMap = {
  __proto__: null!,
  '"': '&quot;',
  "'": '&apos;',
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '\xA0': '&nbsp;',
}
export const escapeAttrApos = createEscaper(/['&\xA0]/g, escapeMap)
export const escapeAttr = createEscaper(/["&\xA0]/g, escapeMap)
export const escapeText = createEscaper(/[&<>\xA0]/g, escapeMap)
export const htmlToText = import.meta.env.TARGET != 'client' ? (html: string, pre = false) => {
  if (!pre) { html = replace(/\r?\n/g, html, '') }
  const _ = cheerio.load(`<div>${html}</div>`, null, false)(':root')
  _.find('div,p,br').after('\n')
  return _.text()
} : null!
