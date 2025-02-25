
//@ts-ignore
export { default as $string } from 'bind:String'
//@ts-ignore
export { default as $array } from 'bind:Array'
import { replace } from 'bind:utils'
import * as cheerio from 'cheerio'

export const noop = () => { }
export const nextTick = queueMicrotask

const REG_NOT_FIRST_32 = /(?<=^.{32}).+$/su
export const onlyFirst32 = (input: string, ellipsis = '…') => replace(REG_NOT_FIRST_32, input, ellipsis)
const REG_LAST = /.$/su
export const removeLast = (input: string) => replace(REG_LAST, input, '')

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
