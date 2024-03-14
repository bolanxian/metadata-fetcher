
globalThis.process ??= {}
globalThis.process.env ??= {}
globalThis.document ??= { addEventListener() { }, createElement() { } }

const { resolve, render, renderList, ready, parseToStore } = await import('./dist/main.ssr.js')
await ready

const [task, ...args] = Deno.args
const { log, error } = console
let $
if (task === 'fetch') {
  for (const arg of args) {
    try {
      let store = parseToStore(arg)
      if (store == null) { continue }
      store = await store
      log('输入：', arg)
      log('解析为：', store.resolved.url)
      log(render(store.parsed))
    } catch (e) {
      error(e)
    }
  }
} else if (task === 'id') {
  for (const arg of args) {
    const resolved = resolve(arg)
    log(resolved?.rawId ?? null, ':', arg)
  }
} else if (task === 'list') {
  for await (const _ of renderList(args)) {
    log(_)
  }
} else if (task === 'serve' || task == null) {
  await import('./server.js')
} else {
  reportError(new RangeError(`unrecognized subcommand '${task}'`))
  Deno.exit(1)
}
