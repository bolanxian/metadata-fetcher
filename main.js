
const NAME = 'Metadata-Fetcher'

globalThis.process ??= {}
globalThis.process.env ??= {}
globalThis.document ??= { addEventListener() { }, createElement() { } }

const { resolve, xparse, render, renderIds, renderList, renderListNameRender, ready } = await import('./dist/main.ssr.js')
await ready

const [task, ...args] = import.meta.main ? Deno.args : [import.meta]
const { log, error } = console

if (task === 'fetch') {
  for (const arg of args) {
    try {
      const [resolved, parsedPromise] = xparse(arg)
      if (resolved == null) { continue }
      log('输入：', arg)
      log('解析为：', resolved.url)
      log(render(await parsedPromise))
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
  const { hideConsole, init } = await import('./tray.js')
  let url = await new Promise((onListen) => { main({ open: false, onListen }) })
  await init(NAME, './dist/favicon.ico', () => { open(url) })
  hideConsole()
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