import { noop } from './bind'

const TARGET = import.meta.env.TARGET
const SSR = TARGET == 'server'
const PAGES = TARGET == 'pages'
const prefix = './__cache__'

let fs: typeof import('node:fs/promises') = null!
let cache: Cache = null!
export const ready = SSR || PAGES ? (async () => {
  if (SSR) {
    try {
      fs = await import('node:fs/promises')
      await fs.mkdir(prefix)
    } catch (error: any) {
      //error.name !== 'AlreadyExists'
      if (error.code !== 'EEXIST') { throw error }
    }
  }
  if (PAGES) {
    cache = await caches.open('metadata-fetcher')
  }
})() : null!

export const getCache = SSR || PAGES ? async (name: string): Promise<string | undefined> => {
  const path = `${prefix}/${name}`
  if (SSR) {
    try {
      return await fs.readFile(path, { encoding: 'utf8' })
    } catch (error: any) {
      //error.name !== 'NotFound'
      if (error.code !== 'ENOENT') { throw error }
    }
  }
  if (PAGES) {
    const resp = await cache.match(path)
    if (resp == null) { return }
    return await resp.text()
  }
} : noop

export const setCache = SSR || PAGES ? async (name: string, text: string) => {
  const path = `${prefix}/${name}`
  if (SSR) {
    await fs.writeFile(path, text)
  }
  if (PAGES) {
    await cache.put(path, new Response(text))
  }
} : noop

const { parse, stringify } = JSON
export const json = TARGET != 'client' ? async<R = any>(
  id: string, loadFn: (id: string) => Promise<R> | R
): Promise<R> => {
  const name = `${id}.json`
  const text = SSR || PAGES ? await getCache(name) : null
  if (text != null) { return parse(text) }
  const data = await loadFn(id)
  SSR || PAGES ? data != null ? await setCache(name, stringify(data)) : null : null
  return data
} : null!