
export const name = 'Metadata Fetcher'
export let [task, ...args] = import.meta.main ? Deno.args : [import.meta]
const { log, error } = console

globalThis.process ??= {}
globalThis.process.env ??= {}
globalThis.document ??= { addEventListener() { }, createElement() { } }

if (task === 'start') {
  log(String(() => {/*
  _   _          __                __            __               
 / \_/ \        /\ \__            /\ \          /\ \__            
/\      \     __\ \  _\   ____    \_\ \    ____ \ \  _\   ____    
\ \ \__\ \  / __ \ \ \/  / __ \   / __ \  / __ \ \ \ \/  / __ \   
 \ \ \_/\ \/\  __/\ \ \_/\ \_\_\_/\ \_\ \/\ \_\_\_\ \ \_/\ \_\_\_ 
  \ \_\\ \_\ \____\\ \__\ \__/\__\ \_____\ \__/\__\\ \__\ \__/\__\
   \/_/ \/_/\/____/ \/__/\/_/\/__/\/____ /\/_/\/__/ \/__/\/_/\/__/

 _____       __           __                      
/\  __\     /\ \__       /\ \                     
\ \ \__   __\ \  _\   ___\ \ \____     __   _ __  
 \ \  _\/ __ \ \ \/  / ___\ \  __ \  / __ \/ / __\
  \ \ \/\  __/\ \ \_/\ \__/\ \ \ \ \/\  __/\ \ \/ 
   \ \_\ \____\\ \__\ \____\\ \_\ \_\ \____\\ \_\ 
    \/_/\/____/ \/__/\/____/ \/_/\/_/\/____/ \/_/ 
*/}).slice(10, -3))
  let status = 0
  try {
    const { setTitle, hideConsole, init } = await import('./tray.js')
    setTitle(name)
    status = 1
    const { main, open } = await import('./server.js')
    const url = await new Promise((onListen) => { main({ open: false, onListen }) })
    await init(name, './dist/favicon.ico', () => { open(url) })
    hideConsole()
  } catch (err) {
    error(err)
    if (status < 1) { task = 'serve' }
  }
}

const {
  resolve, xparse, render, renderIds, renderList, ready,
  renderListNameRender, renderListEscapeRender
} = await import('../dist/main.ssr.js')
await ready

if (task === 'fetch') {
  for (const arg of args) {
    try {
      const [, resolved, redirected, , parsedPromise] = xparse(arg)
      if (resolved == null) { continue }
      log('输入：', arg)
      redirected != null ? log('跳转：', (await redirected).url) : null
      const parsed = await parsedPromise
      parsed != null ? log(render(parsed)) : log('失败：', resolved.id)
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
} else if (task === 'escape') {
  for await (const _ of renderList(args, void 0, renderListEscapeRender)) { log(_) }
} else if (task === 'serve' || task == null) {
  const { main } = await import('./server.js')
  main()
} else if (task === 'start') {

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