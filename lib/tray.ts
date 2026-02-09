
import { fileURLToPath } from 'node:url'
import { encodeText as encode, decodeText as decode, call, $string } from '@/main.ssr'
const { slice } = $string
const { getArrayBuffer } = Deno.UnsafePointerView
const { exit } = Deno, timeout = setTimeout, { error } = console
const { addEventListener: $on, dispatchEvent: $emit } = EventTarget.prototype
const { preventDefault: $preventDefault, stopPropagation: $stopPropagation } = Event.prototype

const tray = Deno.dlopen(fileURLToPath(import.meta.resolve('../dist/tray.dll')), {
  set_console_output_code_page: { parameters: ['u32'], result: 'i32' },
  set_title: { parameters: ['buffer', 'usize'], result: 'i32' },
  show_console: { parameters: ['i32'], result: 'i32' },
  tray_init: {
    parameters: ['buffer', 'usize', 'buffer', 'usize', 'function'],
    result: 'i32',
    nonblocking: true
  },
  tray_deinit: {
    parameters: [],
    result: 'void'
  },
  tray_notification: {
    parameters: ['buffer', 'usize', 'buffer', 'usize'],
    result: 'void'
  }
})
const { set_console_output_code_page, set_title, show_console, tray_init, tray_deinit, tray_notification } = tray.symbols

export const setConsoleOutputCP = (code_page_id: number) => set_console_output_code_page(code_page_id) != 0
export const setTitle = (title_str: string) => {
  const title = encode(title_str)
  return set_title(title, title.length as any) != 0
}
export const hideConsole = () => show_console(0) != 0
export const showConsole = () => show_console(1) != 0
let ready: Promise<void>, ok: () => void, reject: (reason: string) => void, name: string
let closed: Promise<number>, onClick: () => void
const fn = new Deno.UnsafeCallback({
  parameters: ['buffer', 'usize'],
  result: 'void'
}, (ptr, len) => {
  const str = decode(getArrayBuffer(ptr!, len as any))
  outer: switch (str[0]) {
    case '@': switch (slice(str, 1)) {
      case 'success': timeout(ok, 0); break
      case 'open':
      case 'click': timeout(onClick, 0); break
      case 'show': showConsole(); break
      case 'hide': hideConsole(); break
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
})
export const init = (name_str: string, path_str: string, on_click: () => void) => {
  if (closed != null) { return }
  const name_buf = encode(name_str)
  const path_buf = encode(path_str)
  name = name_str
  onClick = on_click
  ready = new Promise(($1, $2) => { ok = $1; reject = $2 })
  closed = tray_init(name_buf, name_buf.length as any, path_buf, path_buf.length as any, fn.pointer)
  return ready
}
export const deinit = () => {
  if (closed == null) { return }
  tray_deinit()
  closed = onClick = (void 0)!
}
export const notification = (text_str: string, title_str = '') => {
  const text = encode(text_str)
  const title = title_str.length > 0 ? encode(title_str) : null
  tray_notification(text, text.length as any, title, title_str.length > 0 ? title!.length as any : 0)
}
call($on, null, 'unload', e => { deinit() })
call($on, null, 'unhandledrejection', e => {
  if (closed == null) { return }
  error((e as PromiseRejectionEvent).reason)
  notification('发生错误', name)
  call($preventDefault, e)
  call($stopPropagation, e)
})
call($on, null, 'error', e => {
  if (closed == null) { return }
  error((e as ErrorEvent).error)
  notification('发生错误', name)
  call($preventDefault, e)
  call($stopPropagation, e)
})
Deno.addSignalListener("SIGINT", () => { exit(0) })
