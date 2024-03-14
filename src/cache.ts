

const SSR = import.meta.env.SSR
const PAGES = import.meta.env.PAGES

let cache: Cache = null!
export const ready = SSR || PAGES ? (async () => {
  cache = await caches.open('metadata-fetcher')
})() : null!

export const getCache = SSR || PAGES ? async (path: string): Promise<string | undefined> => {
  if (SSR) {
    try {
      //@ts-expect-error
      return await Deno.readTextFile(path)
    } catch (error) {
      //@ts-expect-error
      if (!(error instanceof Deno.errors.NotFound)) { throw error }
    }
  }
  if (PAGES) {
    const resp = await cache.match(path)
    if (resp == null) { return }
    return await resp.text()
  }
} : null!

export const setCache = SSR || PAGES ? async (path: string, text: string) => {
  if (SSR) {
    //@ts-expect-error
    await Deno.writeTextFile(path, text)
  }
  if (PAGES) {
    await cache.put(path, new Response(text))
  }
} : null!
