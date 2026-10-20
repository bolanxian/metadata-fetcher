
import { stat, opendir, open as openFileHandle } from 'node:fs/promises'
import { LRUCache } from 'lru-cache'
import { encodeText as encode, match, split } from 'bind:utils'
import { trim, slice, lastIndexOf } from 'bind:String'
import { empty, escapeBatch } from '@/bind'
import { renderBatch, type BatchResult } from '@/render'
import { S, createBatchParams } from '@/components/app.vue'
import { illustId, illustName } from '@/utils/illust-name'
import { getDiscoverGlobalRegExp, resolve } from '@/meta-fetch/mod'
import {
  name, basename, url, server, TYPE, types, $, open,
  isLocalHost, isLocalHostOrigin, isNavigateDocument,
  $redirect, $success, $error,
} from './core'
declare const { ReadableStream }: typeof import('node:stream/web')

type FileMapKey = `${'F' | 'D'}-${string}`
type GetIter = (path: string) => AsyncIterableIterator<string>
type Mode = {
  matchId(line: string): IterableIterator<string>
  getName(line: string): Promise<{ error: string | null, name: string } | undefined>
}

const modeDefault: Mode = {
  *matchId(line) {
    for (const id of match(getDiscoverGlobalRegExp(), line) ?? empty) {
      const newId = resolve(id)?.id
      if (newId != null) { yield newId }
    }
  },
  async getName(line) {
    let name = line, ext = '', i = lastIndexOf(line, '.')
    if (i > 0) { name = slice(line, 0, i); ext = slice(line, i) }
    let id: string | undefined; for (id of modeDefault.matchId(name)) { break }
    if (id == null) { return }
    let result: BatchResult | undefined; for await (result of renderBatch([id], 'name')) { break }
    name = result?.error === null ? result.value : `[${id}]`
    return { error: result?.error ?? null, name: `${name}${ext}` }
  }
}
const modeIllust: Mode = {
  *matchId(line) {
    const id = illustId(line)
    if (id != null) { yield id }
  },
  getName: illustName
}

export const fileMap = new LRUCache<FileMapKey, string>({ max: 10 })
const modeMap: Record<string, Mode> = {
  __proto__: null!,
  default: modeDefault,
  illust: modeIllust,
}

async function* generateBatch(getIter: GetIter, mode: Mode, path: string) {
  try {
    const { getName } = mode
    yield encode('\r\nchcp 65001\r\npause\r\n\r\n')
    for await (const line of getIter(path)) {
      const result = await getName(line)
      if (result == null) { continue }
      const { error, name } = result
      yield encode(`ren "${escapeBatch(line)}" "${escapeBatch(name)}"\r\n`)
      if (error != null) {
        yield encode(`rem "Error: ${escapeBatch(error)}"\r\n`)
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

  const mode = modeMap[params.get('mode') ?? 'default']
  if (mode == null) { return $error(400, name) }

  const guid = params.get('guid') ?? ''
  let getIter: GetIter
  switch (slice(guid, 0, 2)) {
    case 'F-': getIter = genFile; break
    case 'D-': getIter = genDirectory; break
    default: return $error(400, name)
  }
  const path = fileMap.get(guid as any)
  if (path == null) { return $error(404, name) }

  if (params.get('output') === 'batch') {
    const body: ReadableStream = ReadableStream.from(generateBatch(getIter, mode, path)) as any
    return new Response(body, {
      headers: {
        server, [TYPE]: `${types.txt};charset=UTF-8`,
        'content-disposition': `inline; filename="rename.bat"; filename*=UTF-8''rename.bat`,
      }
    })
  }
  const { matchId } = mode
  const set = new Set<string>(); let i = 0
  loop: for await (const data of getIter(path)) {
    for (const id of matchId(data)) {
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
    for await (const dirent of dir) {
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
