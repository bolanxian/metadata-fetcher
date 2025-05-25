
export const name = 'Metadata Fetcher'

import { argv, exit } from 'node:process'
export let [, , task, ...args] = import.meta.main || import.meta.filename === argv[1] ? argv : [, , import.meta]
const { log, error } = console

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
  let step = 0
  try {
    const { setConsoleOutputCP, setTitle, hideConsole, init, notification } = await import('./tray.js')
    setConsoleOutputCP(65001)
    setTitle(name)
    step = 1
    const { main, open } = await import('./server.js')
    const { url } = await main()
    await init(name, './dist/favicon.ico', () => { open(url) })
    hideConsole()
    notification('已启动', name)
  } catch (err) {
    error(err)
    if (step < 1) { task = 'serve' }
  }
}

const {
  resolve, xparse, render, renderBatch, ready
} = await import('../dist/main.ssr.js')
await ready

if (task === 'fetch') {
  for (const arg of args) {
    try {
      const [, resolved, redirected, , parsedPromise] = xparse(arg)
      if (resolved == null) { continue }
      log(`输入：${arg}`)
      redirected != null ? log(`跳转：${(await redirected).url}`) : null
      const parsed = await parsedPromise
      parsed != null ? log(render(parsed)) : log(`失败：${resolved.id}`)
    } catch (e) {
      error(e)
    }
  }
} else if (task === 'batch') {
  const [type, ..._args] = args
  for await (const _ of renderBatch(_args, type)) { log(_) }
} else if (task === 'id' || task === 'list' || task === 'name' || task === 'escape') {
  for await (const _ of renderBatch(args, task)) { log(_) }
} else if (task === 'serve' || task == null) {
  const { main, open } = await import('./server.js')
  const { url } = await main()
  await open(url)
} else if (task === 'start') {

} else if (task !== import.meta) {
  reportError(new RangeError(`unrecognized subcommand '${task}'`))
  exit(1)
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