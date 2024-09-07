
globalThis.process ??= {}
globalThis.process.env ??= {}
globalThis.document ??= { addEventListener() { }, createElement() { } }

const { name, resolve, xparse, render, renderIds, renderList, renderListNameRender, ready } = await import('../dist/main.ssr.js')
await ready

export const [task, ...args] = import.meta.main ? Deno.args : [import.meta]
const { log, error } = console

if (task === 'fetch') {
  for (const arg of args) {
    try {
      const [resolved, parsedPromise] = xparse(arg)
      if (resolved == null) { continue }
      log('输入：', arg)
      const parsed = await parsedPromise
      parsed != null ? log(render(parsed)) : null
    } catch (e) {
      error(e)
    }
  }
} else if (task === 'id') {
  for (const _ of renderIds(args)) { log(_) }
} else if (task === 'list') {
  for await (const _ of renderList(args)) { log(_) }
} else if (task === 'name') {
  for await (const _ of renderList(args, void 0, renderListNameRender)) { log(_) }
} else if (task === 'serve' || task == null) {
  const { main } = await import('./server.js')
  main()
} else if (task === 'start') {
  const { main, open } = await import('./server.js')
  const TRAY = import('./tray.js')
  const urlPromise = new Promise((onListen) => { main({ open: false, onListen }) })
  try {
    const { hideConsole, init } = await TRAY
    const url = await urlPromise
    await init(name, './dist/favicon.ico', () => { open(url) })
    hideConsole()
  } catch (err) {
    error(err)
    open(await urlPromise)
  }
} else if (task !== import.meta) {
  reportError(new RangeError(`unrecognized subcommand '${task}'`))
  Deno.exit(1)
} else {
  Deno.bench('av号', () => {
    resolve('av1')
  })
  Deno.bench('BV号', () => {
    resolve('raw!BV1xx411c7mQ')
  })
  Deno.bench('av2bv', () => {
    resolve('bv!av1')
  })
  Deno.bench('bv2av', () => {
    resolve('BV1xx411c7mQ')
  })
}