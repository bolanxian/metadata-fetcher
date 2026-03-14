
import { fileURLToPath } from 'node:url'
import process, { exit } from 'node:process'
import { encodeText as encode, decodeText as decode, call, $string } from '@/main.ssr'
const { slice } = $string, { error } = console, timeout = setTimeout
const { dispatchEvent: $emit } = EventTarget.prototype
const filename = fileURLToPath(import.meta.resolve('../dist/tray.dll'))

let runtime = 'unknown'
switch (`${typeof Deno}:${typeof Bun}`) {
  case 'object:undefined': runtime = 'deno'; break
  case 'undefined:object': runtime = 'bun'; break
}

type i32 = number
type u32 = number
type usize = bigint
type Buffer = Uint8Array<ArrayBuffer> | null
type Fn = Deno.PointerObject

let UnsafeCallback: typeof Deno.UnsafeCallback
let getArrayBuffer: typeof Deno.UnsafePointerView.getArrayBuffer

let tray: any, $handle: any, $$handle: Fn
let $fn: <R, A extends unknown[]>(result: R, ...parameters: readonly [...A]) => Readonly<{
  parameters: readonly [...A]
  result: R
}>
let symbols: Readonly<{
  set_console_output_code_page: (code: u32) => i32
  set_title: (buf: Buffer, len: usize) => i32
  show_console: (show: i32) => i32
  tray_init: (name_buf: Buffer, name_len: usize, path_buf: Buffer, path_len: usize, handle: Fn) => i32
  tray_deinit: () => void
  tray_pick: (handle: Fn, flags: u32) => i32
  tray_notification: (text_buf: Buffer, text_len: usize, title_buf: Buffer, title_len: usize) => void
}>
switch (runtime) {
  case 'deno': {
    void ({ UnsafeCallback } = Deno)
    void ({ getArrayBuffer } = Deno.UnsafePointerView)
    $fn = (result, ...parameters) => ({ parameters, result })
    const tray_inner = Deno.dlopen(filename, {
      set_console_output_code_page: $fn('i32', 'u32'),
      set_title: $fn('i32', 'buffer', 'usize'),
      show_console: $fn('i32', 'i32'),
      tray_init: $fn('i32', 'buffer', 'usize', 'buffer', 'usize', 'function'),
      tray_deinit: $fn('void'),
      tray_pick: $fn('i32', 'function', 'u32'),
      tray_notification: $fn('void', 'buffer', 'usize', 'buffer', 'usize'),
    })
    tray = tray_inner
    symbols = tray_inner.symbols
    const fn_inner = new Deno.UnsafeCallback($fn('void', 'buffer', 'usize'), (ptr, len) => {
      handle(decode(getArrayBuffer(ptr!, len as any)))
    })
    $handle = fn_inner
    $$handle = fn_inner.pointer
  } break
  case 'bun': {
    const { dlopen, JSCallback, CString } = await import('bun:ffi')
    const $fn = <R, A extends unknown[]>(returns: R, ...args: readonly [...A]) => ({ args, returns } as const)
    tray = dlopen(filename, {
      set_console_output_code_page: $fn('i32', 'u32'),
      set_title: $fn('i32', 'buffer', 'usize'),
      show_console: $fn('i32', 'i32'),
      tray_init: $fn('i32', 'buffer', 'usize', 'buffer', 'usize', 'callback'),
      tray_deinit: $fn('void'),
      tray_notification: $fn('void', 'buffer', 'usize', 'buffer', 'usize'),
    })
    symbols = tray.symbols
    $handle = new JSCallback((ptr, len) => {
      handle(`${new CString(ptr, len)}`)
    }, $fn('void', 'buffer', 'usize'))
    $$handle = $handle
  } break
  default: throw new TypeError(`FFI is not supported.(Runtime: ${runtime})`)
}

const {
  set_console_output_code_page, set_title, show_console,
  tray_init, tray_deinit, tray_pick, tray_notification
} = symbols

export const setConsoleOutputCP = (code_page_id: number) => set_console_output_code_page(code_page_id) != 0
export const setTitle = (title_str: string) => {
  const title = encode(title_str)
  return set_title(title, title.length as any) != 0
}
export const hideConsole = () => show_console(0) != 0
export const showConsole = () => show_console(1) != 0
let ready: Promise<void>, ok: () => void, reject: (reason: string) => void
let name: string | null = null, onClick: (() => void) | null = null
const handle = (str: string) => {
  outer: switch (str[0]) {
    case '@': switch (slice(str, 1)) {
      case 'success': timeout(ok, 0); break
      case 'open':
      case 'click': timeout(onClick!, 0); break
      case 'create_lnk': timeout(() => {
        call($emit, null, new Event('tray:create-lnk'))
      }, 0); break
      case 'show': timeout(showConsole, 0); break
      case 'hide': timeout(hideConsole, 0); break
      case 'exit': timeout(exit, 0, 0); break
    } break
    case '!': reject(slice(str, 1)); break
    case '#': {
      let type: string
      switch (str[1]) {
        case 'F': type = 'file'; break
        case 'D': type = 'directory'; break
        default: break outer
      }
      const e = new CustomEvent(`tray:open:${type}`, { detail: slice(str, 2) })
      timeout(() => { call($emit, null, e) }, 0)
    } break
  }
}

export const init = (name_str: string, path_str: string, on_click: () => void) => {
  if (name != null) { return }
  const name_buf = encode(name = name_str)
  const path_buf = encode(path_str)
  onClick = on_click
  ready = new Promise(($1, $2) => { ok = $1; reject = $2 })
  if (tray_init(name_buf, name_buf.length as any, path_buf, path_buf.length as any, $$handle) != 0) {
    name = onClick = null
  }
  return ready
}
export const deinit = () => {
  if (name == null) { return }
  tray_deinit()
  name = onClick = null
}
export const pick = async (isDir: boolean): Promise<string | null> => {
  let resolve: (data: string) => void
  const promise = new Promise<string>($1 => { resolve = $1 })
  const fn = new UnsafeCallback($fn('void', 'buffer', 'usize'), (ptr, len) => {
    resolve(decode(getArrayBuffer(ptr!, len as any)))
  })
  try {
    if (tray_pick(fn.pointer, isDir ? 1 : 0) != 0) { return null }
    return await promise || null
  } finally {
    fn.close()
  }
}
export const notification = (text_str: string, title_str = '') => {
  const text = encode(text_str)
  const title = title_str.length > 0 ? encode(title_str) : null
  tray_notification(text, text.length as any, title, title_str.length > 0 ? title!.length as any : 0)
}
process.on('uncaughtException', e => {
  error(e)
  if (name != null) { notification('发生错误', name) }
})
process.on('SIGINT', () => { exit(0) })
process.on('exit', code => { deinit() })
