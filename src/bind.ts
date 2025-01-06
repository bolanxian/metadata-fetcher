
import * as cheerio from 'cheerio'

export const noop = () => { }
export const nextTick = queueMicrotask

export const { apply } = Reflect
const { bind: _bind, call: _call } = Function.prototype
const _bindCall = apply(_bind, _bind, [_call])

const bindMap = new WeakMap()
const { get: _get, set: _set } = WeakMap.prototype
const get = _bindCall(_get)
const set = _bindCall(_set)
set(bindMap, _get, get)
set(bindMap, _set, set)
export const bindCall = ((fn) => {
  let bound = get(bindMap, fn)
  if (bound == null) {
    bound = _bindCall(fn)
    set(bindMap, fn, bound)
  }
  return bound
}) as <F>(func: F) => <
  T extends F extends (this: infer T, ...args: any[]) => any ? T : never,
  A extends F extends (...args: infer A) => any ? [...A] : never
>(thisArg: T, ...args: A) => F extends (this: T, ...args: A) => infer R ? R : never

export const call = bindCall(_call) as <T, A extends unknown[], R>(
  func: (this: T, ...args: A) => R, thisArg: T, ...args: A
) => R
export const bind = bindCall(_bind) as <T, A extends unknown[], R>(
  func: (this: T, ...args: A) => R, thisArg: T
) => (...args: A) => R

const $Proxy = Proxy, handler = {
  get(target: any, key: string, receiver: any) {
    const value = target[key]
    if (typeof value === 'function') {
      return bindCall(value)
    }
  }
}

const createBinder = <T extends {}>(o: T) => new $Proxy(o, handler) as {
  [K in Exclude<keyof T, T extends any[] ? number : never>]:
  T[K] extends (...args: infer A) => infer R
  ? (thisArg: T, ...args: A) => R
  : never
}

export const $number = createBinder(Number.prototype)
export const $string = createBinder(String.prototype)
export const $array = createBinder(Array.prototype)

export const { assign, fromEntries, getOwnPropertyDescriptor: getPropDesc, freeze } = Object
const ObjectProto = Object.prototype
export const hasOwn = Object.hasOwn ?? bindCall(ObjectProto.hasOwnProperty)
export const getTypeString = bindCall(ObjectProto.toString)
export const isPlainObject = (o: any) => {
  o = getTypeString(o)
  return o === '[object Object]' || o === '[object Array]'
}

export const encodeText = bind(TextEncoder.prototype.encode, new TextEncoder())
export const decodeText = bind(TextDecoder.prototype.decode, new TextDecoder())
export const $then = bindCall(Promise.prototype.then)
export const test = bindCall(RegExp.prototype.test)
export const match = bindCall(RegExp.prototype[Symbol.match])
export const replace = bindCall(RegExp.prototype[Symbol.replace])
export const split = bindCall(RegExp.prototype[Symbol.split])
export const pipeTo = bindCall(ReadableStream.prototype.pipeTo)

const EventTargetProto = EventTarget.prototype
export const on = bindCall(EventTargetProto.addEventListener)
export const off = bindCall(EventTargetProto.removeEventListener)

export type Get<T, K extends PropertyKey> = T extends { [_ in K]: any } ? T[K] : undefined
export const getOwn = <T extends {}, K extends PropertyKey>(o: T, k: K): Get<T, K> | undefined => {
  return hasOwn(o, k) ? (o as any)[k] : void 0
}
export const getAsync = async<
  T extends { [_ in K]: any }, K extends PropertyKey
>($: Promise<T>, key: K): Promise<Awaited<T[K]>> => (await $)[key]

const REG_NOT_FIRST_32 = /(?<=^.{32}).+$/su
export const onlyFirst32 = (input: string) => replace(REG_NOT_FIRST_32, input, '...' as any)
const REG_LAST = /.$/su
export const removeLast = (input: string) => replace(REG_LAST, input, '' as any)

const createEscaper = (reg: RegExp, map: Record<string, string>) => {
  const cb = (sub: string) => map[sub] ?? ''
  return (input: string) => replace(reg, input, cb)
}
const escapeMap = {
  __proto__: null!,
  '"': '&quot;',
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '\xA0': '&nbsp;',
}
export const escapeAttr = createEscaper(/["&\xA0]/g, escapeMap)
export const escapeText = createEscaper(/[&<>\xA0]/g, escapeMap)
export const htmlToText = import.meta.env.TARGET != 'client' ? (html: string, pre = false) => {
  if (!pre) { html = replace(/\r?\n/g, html, '' as any) }
  const _ = cheerio.load(`<div>${html}</div>`, null, false)(':root')
  _.find('div,p,br').after('\n')
  return _.text()
} : null!
