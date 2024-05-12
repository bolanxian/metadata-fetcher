
const _console = Deno.dlopen('./dist/console.dll', {
  hideConsole: { parameters: [], result: 'void' },
  showConsole: { parameters: [], result: 'void' }
})
export const { hideConsole, showConsole } = _console.symbols

const tray = Deno.dlopen('./dist/tray.dll', {
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

const { bind: _bind, call: _call } = Function.prototype
const bindCall = Reflect.apply(_bind, _bind, [_call])
const bind = bindCall(Function.prototype.bind)
const encode = bind(TextEncoder.prototype.encode, new TextEncoder())

const { init: _init, deinit: _deinit, notification: _notification } = tray.symbols
const { exit } = Deno, timeout = setTimeout
let ready, resolve, name
let closed, onClick
const fn = new Deno.UnsafeCallback({
  parameters: ['i32'],
  result: 'void'
}, (i) => {
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
export const init = (__name, path, _onClick) => {
  if (closed != null) { return }
  const _name = encode(__name)
  const _path = encode(path)
  name = __name
  onClick = _onClick
  ready = new Promise((_) => { resolve = _ })
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
