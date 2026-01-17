
import { LRUCache } from 'lru-cache'
import { empty } from '@/bind'
import { replaceAll, indexOf, slice } from 'bind:String'
import { keys } from 'bind:Array'
type FS = typeof import('node:fs/promises')
const { parse, stringify } = JSON

export type TryGetFn = () => Promise<string | undefined>
export let cache: BaseCache = null!
export let initCache = (_cache: BaseCache) => {
  initCache = null!
  cache = _cache
}
const resolveName = (name: string) => replaceAll(name, '/', '!')

export abstract class BaseCache {
  abstract get(name: string): Promise<string | undefined>
  abstract tryGet(name: string, fn: TryGetFn): Promise<string | undefined>
  abstract set(name: string, value: string): Promise<void>
  abstract keys(): Iterator<string>
  async json<R = any>(id: string, fn: () => Promise<R>): Promise<R> {
    const name = `${id}.json`
    let data: R | undefined
    const text = await this.tryGet(name, async () => {
      data = await fn()
      if (data !== void 0) { return stringify(data) }
    })
    if (data !== void 0) { return data }
    if (text != null) { return parse(text) }
    return (void 0)!
  }
}
export class NoCache extends BaseCache {
  async get(name: string): Promise<string | undefined> { return }
  async tryGet(name: string, fn: TryGetFn): Promise<string | undefined> {
    return await fn()
  }
  async set(name: string, value: string): Promise<void> { }
  keys() { return keys(empty as any) as Iterator<string> }
}
export class FsCache extends BaseCache {
  #readFile: FS['readFile']
  #writeFile: FS['writeFile']
  #prefix: string
  #lru: LRUCache<string, string, TryGetFn | undefined>
  get lru() { return this.#lru }
  static async create(prefix: string) {
    const fs = await import('node:fs/promises')
    try {
      await fs.mkdir(prefix)
    } catch (error: any) {
      //error.name !== 'AlreadyExists'
      if (error.code !== 'EEXIST') { throw error }
    }
    return new this(fs, prefix)
  }
  constructor(fs: FS, prefix: string) {
    super()
    this.#readFile = fs.readFile
    this.#writeFile = fs.writeFile
    this.#prefix = prefix
    type Fetcher = LRUCache.Fetcher<string, string, TryGetFn | undefined>
    const fetchMethod: Fetcher = async (name, staleValue, { signal, context }) => {
      name = resolveName(name)
      const path = `${prefix}/${name}`
      try {
        return await this.#readFile(path, { encoding: 'utf8', signal })
      } catch (error: any) {
        //error.name !== 'NotFound'
        if (error.code !== 'ENOENT') { throw error }
      }
      if (context != null) {
        const ret = await context()
        if (ret != null) { await this.#writeFile(path, ret) }
        return ret
      }
    }
    this.#lru = new LRUCache({ max: 200, fetchMethod })
  }
  async get(name: string) {
    name = resolveName(name)
    return await this.#lru.fetch(name)
  }
  async tryGet(name: string, fn: TryGetFn) {
    name = resolveName(name)
    return await this.#lru.fetch(name, { context: fn })
  }
  async set(name: string, value: string) {
    name = resolveName(name)
    const path = `${this.#prefix}/${name}`
    this.#lru.set(name, value)
    await this.#writeFile(path, value)
  }
  *keys() {
    for (let key of this.#lru.keys()) {
      if (key[0] !== '_') {
        const i = indexOf(key, '.')
        if (i > 0) { key = slice(key, 0, i) }
        yield key
      }
    }
  }
}
export class WebCache extends BaseCache {
  #cache: Cache = null!
  static async create() {
    const cache = await caches.open('metadata-fetcher')
    return new this(cache)
  }
  constructor(cache: Cache) {
    super()
    this.#cache = cache
  }
  async get(name: string) {
    name = resolveName(name)
    const resp = await this.#cache.match(`/${name}`)
    if (resp == null) { return }
    return await resp.text()
  }
  async tryGet(name: string, fn: TryGetFn) {
    name = resolveName(name)
    let resp = await this.#cache.match(`/${name}`)
    if (resp == null) {
      const data = await fn()
      if (data == null) { return }
      resp = new Response(data)
      await this.#cache.put(`/${name}`, resp.clone())
    }
    return await resp.text()
  }
  async set(name: string, value: string) {
    name = resolveName(name)
    await this.#cache.put(`/${name}`, new Response(value))
  }
  keys() { return keys(empty as any) as Iterator<string> }
}

