
globalThis.process ??= {}
globalThis.process.env ??= {}
globalThis.document ??= { addEventListener() { }, createElement() { } }

const { resolve, render, readTemplate, parseToStore } = await import('./dist/main.ssr.js')
await readTemplate()

const [task, ...args] = Deno.args
const { log, error } = console
let $
if (task === 'fetch') {
  $ = (arg, store) => {
    log('输入：', arg)
    log('解析为：', store.resolved.url)
    log(render(store.parsed))
  }
} else if (task === 'list') {
  $ = (arg, store) => {
    const { title, ownerName, url } = store.parsed
    const id = resolve(url)?.id ?? store.resolved.id
    log(`${title}\uFF0F${id}\uFF0F${ownerName}`)
  }
} else if (task === 'serve' || task == null) {
  await import('./server.js')
} else {
  reportError(new RangeError(`unrecognized subcommand '${task}'`))
  Deno.exit(1)
}
if ($ != null) {
  for (const arg of args) {
    try {
      let store = parseToStore(arg)
      if (store == null) { continue }
      $(arg, await store)
    } catch (e) {
      error(e)
    }
  }
}