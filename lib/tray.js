
const { bind: _bind, call: _call } = Function.prototype
const bindCall = Reflect.apply(_bind, _bind, [_call])
const bind = bindCall(Function.prototype.bind)
const encode = bind(TextEncoder.prototype.encode, new TextEncoder())

const tray = Deno.dlopen('./dist/tray.dll', {
  setTitle: { parameters: ['buffer', 'usize'], result: 'i32' },
  hideConsole: { parameters: [], result: 'void' },
  showConsole: { parameters: [], result: 'void' },
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
    case 1: onClick?.(); break
    case 2: showConsole(); break
    case 3: hideConsole(); break
    case 16: timeout(exit, 0, 0); break
  }
})
export const setTitle = (_title) => {
  const title = encode(_title)
  _setTitle(title, title.length)
}
export const init = (__name, path, _onClick) => {
  if (closed != null) { return }
  const _name = encode(__name)
  const _path = encode(path)
  name = __name
  onClick = _onClick
  ready = new Promise((_, __) => { resolve = _; reject = __ })
  closed = _init(fn.pointer, _name, _name.length, _path, _path.length)
  return ready
}
export const deinit = () => {
  if (closed == null) { return }
  _deinit()
  closed = onClick = void 0
}
export const notification = (text, title = '') => {
  const _text = encode(text)
  const _title = encode(title)
  _notification(_text, _text.length, _title, _title.length)
}
addEventListener('unload', e => { deinit() })
Deno.addSignalListener("SIGINT", () => { exit(0) })
