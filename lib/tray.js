
import { bindCall } from '../dist/main.ssr.js'
/** @type {<T>($:T)=>T} */
const bind = bindCall(Function.prototype.bind)
const encode = bind(TextEncoder.prototype.encode, new TextEncoder())

const tray = Deno.dlopen(new URL('../dist/tray.dll', import.meta.url), {
  setTitle: { parameters: ['buffer', 'usize'], result: 'i32' },
  hideConsole: { parameters: [], result: 'i32' },
  showConsole: { parameters: [], result: 'i32' },
  init: {
    parameters: ['function', 'buffer', 'usize', 'buffer', 'usize'],
    result: 'i32',
    nonblocking: true
  },
  deinit: {
    parameters: [],
    result: 'void'
  },
  notification: {
    parameters: ['buffer', 'usize', 'buffer', 'usize'],
    result: 'void'
  }
})

export const { hideConsole, showConsole } = tray.symbols
const { setTitle: _setTitle, init: _init, deinit: _deinit, notification: _notification } = tray.symbols
const { exit } = Deno, timeout = setTimeout
let ready, resolve, reject, name
let closed, onClick
const fn = new Deno.UnsafeCallback({
  parameters: ['i32'],
  result: 'void'
}, (i) => {
  if (i < 0) {
    switch (-i) {
      case 1: reject('Already inited'); break
      case 2: reject('Nwg init error'); break
      case 3: reject('Tray build error'); break
    }
    return
  }
  switch (i) {
    case 0:
      timeout(notification, 0, '已启动', name)
      resolve()
      break
    case 1: timeout(onClick, 0); break
    case 2: showConsole(); break
    case 3: hideConsole(); break
    case 16: timeout(exit, 0, 0); break
  }
})
export const setTitle = (_title) => {
  const title = encode(_title)
  _setTitle(title, title.length)
}
export const init = (name_str, path_str, _onClick) => {
  if (closed != null) { return }
  const name_buf = encode(name_str)
  const path_buf = encode(path_str)
  name = name_str
  onClick = _onClick
  ready = new Promise(($1, $2) => { resolve = $1; reject = $2 })
  closed = _init(fn.pointer, name_buf, name_buf.length, path_buf, path_buf.length)
  return ready
}
export const deinit = () => {
  if (closed == null) { return }
  _deinit()
  closed = onClick = void 0
}
export const notification = (text, title = '') => {
  const _text = encode(text)
  const _title = title.length > 0 ? encode(title) : null
  _notification(_text, _text.length, _title, title.length > 0 ? _title.length : 0)
}
addEventListener('unload', e => { deinit() })
Deno.addSignalListener("SIGINT", () => { exit(0) })
