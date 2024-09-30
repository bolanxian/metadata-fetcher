
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
  T, A extends F extends (...args: infer A) => any ? [...A] : never
>(thisArg: T, ...args: A) => F extends (this: T, ...args: A) => infer R ? R : never

export const call = bindCall(_call) as <T, A extends unknown[], R>(
  func: (this: T, ...args: A) => R, thisArg: T, ...args: A
) => R

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

export const { fromEntries, getOwnPropertyDescriptor: getPropDesc, freeze } = Object
const ObjectProto = Object.prototype
export const hasOwn = Object.hasOwn ?? bindCall(ObjectProto.hasOwnProperty)
export const getTypeString = bindCall(ObjectProto.toString)
export const isPlainObject = (o: any) => {
  o = getTypeString(o)
  return o === '[object Object]' || o === '[object Array]'
}

export const test = bindCall(RegExp.prototype.test)
export const match = bindCall(RegExp.prototype[Symbol.match])
export const replace = bindCall(RegExp.prototype[Symbol.replace])
export const split = bindCall(RegExp.prototype[Symbol.split])

const EventTargetProto = EventTarget.prototype
export const on = bindCall(EventTargetProto.addEventListener)
export const off = bindCall(EventTargetProto.removeEventListener)

export const getAsync = async<
  T extends { [_ in K]: any }, K extends number | string | symbol
>($: Promise<T>, key: K): Promise<Awaited<T[K]>> => (await $)[key]

const REG_DATE = /^\w+\s+\w+\s+(\d\d)\s+(\d{4,6})\s+(\d\d):(\d\d)(?::00|(:\d\d))?\s+(?:GMT|UTC)([-+]\d\d)(\d\d)/
const { getMonth, getDate, getHours, setDate, toString } = Date.prototype, { padStart } = $string
export const dateToLocale = (date: string | number | Date | null | undefined, hour30 = false): string => {
  if (date == null) { return '' }
  date = new Date(date)
  let hours = call(getHours, date)
  if (hour30 && hours < 6) {
    call(setDate, date, call(getDate, date) - 1)
    hours += 24
  }
  const m = match(REG_DATE, call(toString, date))
  if (m == null) { return '' }
  const year = m[2].length > 4 ? `+${padStart(m[2], 6, '0')}` : m[2]
  const month = padStart((call(getMonth, date) + 1) as any, 2, '0')
  hours = padStart(hours as any, 2, '0') as any
  return `${year}-${month}-${m[1]}T${hours}:${m[4]}${m[5] ?? ''}${m[6]}:${m[7]}`
}

export const htmlToText = import.meta.env.TARGET != 'client' ? (html: string, pre = false) => {
  if (!pre) { html = replace(/\r?\n/g, html, '' as any) }
  const _ = cheerio.load(`<div>${html}</div>`, null, false)(':root')
  _.find('div,p,br').after('\n')
  return _.text()
} : null!
