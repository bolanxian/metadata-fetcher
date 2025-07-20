
import { LRUCache } from 'lru-cache'
import { replace } from 'bind:String'
type FS = typeof import('node:fs/promises')

export type TryGetFn = () => Promise<string | undefined>
export interface ICache {
  get(name: string): Promise<string | undefined>
  tryGet(name: string, fn: TryGetFn): Promise<string | undefined>
  set(name: string, value: string): Promise<void>
}
export let cache: ICache = null!
export let initCache = (_cache: ICache) => {
  initCache = null!
  cache = _cache
}

export class NoCache implements ICache {
  async get(name: string): Promise<string | undefined> { return }
  async tryGet(name: string, fn: TryGetFn): Promise<string | undefined> {
    return await fn()
  }
  async set(name: string, value: string): Promise<void> { }
}
export class FsCache implements ICache {
  #readFile: FS['readFile']
  #writeFile: FS['writeFile']
  #prefix: string
  #lru: LRUCache<string, string, TryGetFn | undefined>
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
    this.#readFile = fs.readFile
    this.#writeFile = fs.writeFile
    this.#prefix = prefix
    type Fetcher = LRUCache.Fetcher<string, string, TryGetFn | undefined>
    const fetchMethod: Fetcher = async (name, staleValue, { signal, context }) => {
      name = replace(name, '/', '!')
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
    name = replace(name, '/', '!')
    return await this.#lru.fetch(name)
  }
  async tryGet(name: string, fn: TryGetFn) {
    name = replace(name, '/', '!')
    return await this.#lru.fetch(name, { context: fn })
  }
  async set(name: string, value: string) {
    name = replace(name, '/', '!')
    const path = `${this.#prefix}/${name}`
    this.#lru.set(name, value)
    await this.#writeFile(path, value)
  }
}
export class WebCache implements ICache {
  #cache: Cache = null!
  static async create() {
    const cache = await caches.open('metadata-fetcher')
    return new this(cache)
  }
  constructor(cache: Cache) {
    this.#cache = cache
  }
  async get(name: string) {
    name = replace(name, '/', '!')
    const resp = await this.#cache.match(`/${name}`)
    if (resp == null) { return }
    return await resp.text()
  }
  async tryGet(name: string, fn: TryGetFn) {
    name = replace(name, '/', '!')
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
    name = replace(name, '/', '!')
    await this.#cache.put(`/${name}`, new Response(value))
  }
}

const { parse, stringify } = JSON
export const json = async<R extends {} = any>(
  cache: ICache, id: string, fn: () => Promise<R | undefined> | R | undefined
): Promise<R | undefined> => {
  const name = `${id}.json`
  let data: R | undefined
  const text = await cache.tryGet(name, async () => {
    data = await fn()
    if (data != null) { return stringify(data) }
  })
  if (data != null) { return data }
  if (text != null) { return parse(text) }
}