
export const name = 'Metadata Fetcher'
export let [, , task, ...args]: [any, any, string | ImportMeta, ...string[]]
  = import.meta.main || import.meta.filename === argv[1]
    ? argv as any
    : [, , import.meta]

import { resolve } from 'node:path'
import process, { argv, env, exit } from 'node:process'
import { spawn } from 'node:child_process'
const MAIN = import('@/main.ssr')
const { log, error } = console

if (task === 'start') {
  log(String.raw`
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
`)
  let step = 0
  try {
    const { setConsoleOutputCP, setTitle, hideConsole, init, deinit, notification } = await import('./tray.ts')
    setConsoleOutputCP(65001)
    setTitle(name)
    step = 1
    const { main, open, $, $error } = await import('./server.ts')
    const { ready, $string: { startsWith } } = await MAIN
    await ready
    const { url } = await main()!
    const icon = './dist/favicon.ico'
    const onClick = () => { open?.(url) }
    await init(name, icon, onClick)
    addEventListener('tray:create-lnk', e => {
      const targetPath = resolve('./run.bat')
      const iconPath = resolve(icon)
      const savePath = resolve(env['USERPROFILE'] ?? '.', 'Desktop', `${name}.lnk`)
      const data = JSON.stringify({ targetPath, iconPath, savePath })
      const process = spawn('./dist/reg-utils', ['shortcut', data], { stdio: 'inherit', shell: false })
      process.on('exit', exitCode => {
        exitCode == 0
          ? notification(savePath, '已创建快捷方式')
          : notification(`退出代码：${exitCode}`, '创建快捷方式失败')
      })
    })
    $['reset-tray'] = async ({ remoteAddr, request: { headers } }) => {
      if (!startsWith(remoteAddr, '127.') || headers.has('origin')) { return $error(403, name) }
      deinit()
      await init(name, icon, onClick)
      return $error(200, name, '已复位')
    }
    hideConsole()
    notification('已启动', name)
  } catch (err) {
    error(err)
    if (step < 1) { task = 'serve' }
  }
}

const { ready, xparse, render, renderBatch } = await MAIN
await ready

if (task === 'fetch') {
  for (const arg of args) {
    try {
      const [, resolved, redirectedPromise, , parsedPromise] = xparse(arg)
      if (resolved == null) { continue }
      const pre = `输入：${arg}\n`
      if (redirectedPromise != null) {
        const redirected = await redirectedPromise
        redirected != null
          ? log(`${pre}跳转：${redirected.url}`)
          : log(`${pre}跳转失败：${resolved.id}`)
      } else {
        const parsed = await parsedPromise
        parsed != null
          ? log(render(parsed))
          : log(`${pre}失败：${resolved.id}`)
      }
    } catch (e) {
      error(e)
    }
  }
} else if (task === 'batch') {
  const [type, ..._args] = args
  for await (const $ of renderBatch(_args, type!)) { log($.error ?? $.value) }
} else if (task === 'serve' || task == null) {
  const { main, open } = await import('./server.ts')
  const port = env['PORT'], hostname = env['HOSTNAME']
  const { url } = await main(port != null ? +port : void 0, hostname)!
  await open?.(url)
  process.on('uncaughtException', e => error(e))
} else if (task === 'start') {

} else if (task !== import.meta) {
  error(new RangeError(`unrecognized subcommand '${task}'`))
  exit(1)
}