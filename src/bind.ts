
export { default as $string } from 'bind:String'
export { default as $array } from 'bind:Array'
import { test, replace } from 'bind:utils'
import { toString } from 'bind:Number'
import { fromCharCode, codePointAt, charCodeAt, indexOf, padStart, slice, toUpperCase } from 'bind:String'
import { freeze } from 'bind:Object'
import * as cheerio from 'cheerio'

export const noop = () => { }
export const nextTick = queueMicrotask
export const empty = freeze([])
export const voidPromise = Promise.resolve()

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
const REG_ALL = /./sug
export const escapeJsonSingle = ($0: string) => {
  const codePoint = toUpperCase(toString(codePointAt($0, 0)!, 16))
  return codePoint.length > 4
    ? `\\u{${codePoint}}`
    : `\\u${padStart(codePoint, 4, '0')}`
}
export const escapeJson = (input: string) => replace(REG_ALL, input, escapeJsonSingle)

export const REG_PROTOCOL = /^https?:\/*|^(?:https?)?:?\/{2,}/
export const REG_DOMAIN = /^(?:(?!-)[-0-9a-z]{1,63}(?<!-)\.){1,63}(?=[a-z])[-0-9a-z]{2,63}(?<=[a-z])$/i
export const resolveAsHttp = (input: string) => {
  if (test(REG_PROTOCOL, input)) {
    return replace(REG_PROTOCOL, input, '')
  }
  const slashIndex = indexOf(input, '/')
  if (slashIndex > 0) {
    const maybeDomain = slice(input, 0, slashIndex)
    if (test(REG_DOMAIN, maybeDomain)) {
      return input
    }
  }
  return null
}
export const toHttps = (input: string) => replace(REG_PROTOCOL, input, 'https://')

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
export const escapeAttrApos = createEscaper(/['&<>\xA0]/g, escapeMap)
export const escapeAttr = createEscaper(/["&<>\xA0]/g, escapeMap)
export const escapeText = createEscaper(/[&<>\xA0]/g, escapeMap)
export const htmlToText = import.meta.env.TARGET != 'client' ? (html: string, pre = false) => {
  if (!pre) { html = replace(/\r?\n/g, html, '') }
  const _ = cheerio.load(`<div>${html}</div>`, null, false)(':root')
  _.find('div,p,br').after('\n')
  return _.text()
} : null!
