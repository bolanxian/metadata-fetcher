
import { stat, opendir, open as openFileHandle } from 'node:fs/promises'
import { encodeText as encode, match, split } from 'bind:utils'
import { trim, slice, lastIndexOf } from 'bind:String'
import { LRUCache } from 'lru-cache'
import { illustId, illustName } from '@/utils/illust-name'
import { renderBatch } from '@/render'
import { S, createBatchParams } from '@/components/app.vue'
import { getDiscoverGlobalRegExp, resolve } from '@/meta-fetch/mod'
import {
  name, basename, url, server, TYPE, types, $, open,
  isLocalHost, isLocalHostOrigin, isNavigateDocument,
  $redirect, $success, $error,
} from './core'
declare const { ReadableStream }: typeof import('node:stream/web')

type FileMapKey = `${'F' | 'D'}-${string}`
type GetIter = (path: string) => AsyncIterableIterator<string>
export const fileMap = new LRUCache<FileMapKey, string>({ max: 10 })
function* matchId(data: string) {
  for (const id of match(getDiscoverGlobalRegExp(), data) ?? []) {
    let newId = resolve(id)?.id
    if (newId != null) { yield newId }
  }
}
function* matchIllust(line: string) {
  const id = illustId(line)
  if (id != null) { yield id }
}
async function* xmatcher(getIter: GetIter, mode: string | null, path: string) {
  try {
    yield encode('\r\nchcp 65001\r\npause\r\n\r\n')
    if (mode === 'illust') {
      for await (const line of getIter(path)) {
        const name = await illustName(line)
        if (name == null) { continue }
        yield encode(`ren "${line}" "${name}"\r\n`)
      }
    } else {
      for await (const line of getIter(path)) {
        let name = line, ext = '', i = lastIndexOf(line, '.')
        if (i > 0) { name = slice(line, 0, i); ext = slice(line, i) }
        let id; for (id of matchId(name)) { break }
        if (id == null) { continue }
        let result; for await (result of renderBatch([id], 'name')) { break }
        name = result?.error === null ? result.value : `[${id}]`
        yield encode(`ren "${line}" "${name}${ext}"\r\n`)
        if (result?.error != null) {
          yield encode(`rem "${result.error}"\r\n`)
        }
      }
    }
    yield encode('\r\n:end\r\npause\r\n')
  } catch (e) {
    reportError(e)
    yield encode(':error\r\n')
  }
}
$['file'] = async (ctx) => {
  const { remoteAddr, request: { headers } } = ctx
  if (!(isLocalHost(remoteAddr, headers) && isNavigateDocument(headers))) {
    return $error(403, name)
  }
  const params = ctx.url.searchParams
  const guid = params.get('guid') ?? ''
  let getIter: GetIter
  switch (slice(guid, 0, 2)) {
    case 'F-': getIter = genFile; break
    case 'D-': getIter = genDirectory; break
    default: return $error(400, name)
  }
  const path = fileMap.get(guid as any)
  if (path == null) { return $error(404, name) }

  const mode = params.get('mode')
  if (params.get('output') === 'batch') {
    const body: ReadableStream = ReadableStream.from(xmatcher(getIter, mode, path)) as any
    return new Response(body, {
      headers: {
        server, [TYPE]: `${types.txt};charset=UTF-8`,
        'content-disposition': `inline; filename="rename.bat"; filename*=UTF-8''rename.bat`,
      }
    })
  }
  let matchFn = matchId
  if (mode === 'illust') {
    matchFn = matchIllust
  }
  const set = new Set<string>(); let i = 0
  loop: for await (const data of getIter(path)) {
    for (let id of matchFn(data)) {
      set.add(id)
      if (128 < ++i) {
        set.add('!truncate')
        break loop
      }
    }
  }
  const batch = params.get('batch') ?? '.id'
  const location = new URL(`./.batch?${createBatchParams(batch, set)}`, ctx.url).href
  return $redirect(location)
}
const genFile: GetIter = async function* (path) {
  const MAX_SIZE = 16 * 1024 * 1024
  const fileHandle = await openFileHandle(path, 'r');
  try {
    const stat = await fileHandle.stat()
    if (stat.size > MAX_SIZE) { return }
    const data = await fileHandle.readFile({ encoding: 'utf-8' })
    for (const line of split(S, data)) { yield line }
  } finally {
    await fileHandle.close()
  }
}
const genDirectory: GetIter = async function* (path) {
  const dir = await opendir(path)
  try {
    for await (let dirent of dir) {
      yield dirent.name
    }
  } finally {
    await dir.close()
  }
}
$['open-file'] = async ({ remoteAddr, request }) => {
  const { method, headers } = request
  if (!(
    method === 'PUT' &&
    isLocalHostOrigin(remoteAddr, headers) &&
    headers.get(`sec-x-${basename}`) === 'true'
  )) {
    return $error(403, name)
  }
  const path = trim(await request.text())
  const stats = await stat(path)
  let type: Parameters<typeof openFile>[0]
  if (stats.isDirectory()) {
    type = 'directory'
  } else if (stats.isFile()) {
    type = 'file'
  } else {
    return $error(403, name)
  }
  openFile(type, path)
  return $success()
}
const openFile = (type: 'file' | 'directory', path: string) => {
  if (url == null || open == null) { return }
  const uuid = crypto.randomUUID()
  let guid: FileMapKey
  switch (type) {
    case 'file': guid = `F-${uuid}`; break
    case 'directory': guid = `D-${uuid}`; break
    default: return
  }
  fileMap.set(guid, path)
  open(`${url}!${guid}`)
}
if (typeof addEventListener == 'function') {
  for (const type of ['file', 'directory'] as const) {
    addEventListener(`tray:open:${type}`, e => {
      const path = (e as CustomEvent<string>).detail
      openFile(type, path)
    })
  }
}
