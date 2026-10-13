
import type { SpawnOptions, ChildProcess } from 'node:child_process'
import { $then } from 'bind:utils'
import { trim } from 'bind:String'
const { parse, stringify } = JSON
const TARGET = import.meta.env.TARGET
const SSR = TARGET == 'server'

let spawn: typeof import('node:child_process')['spawn']
let Readable: typeof import('node:stream')['Readable']
let regUtilsOptions: SpawnOptions

export const ready = SSR ? $then(Promise.all([
  import('node:child_process'),
  import('node:stream'),
]), ([cp, stream]) => {
  void ({ spawn } = cp)
  void ({ Readable } = stream)
}) : null!

const regUtils = (args: string[]): ChildProcess => {
  regUtilsOptions ??= { stdio: ['ignore', 'pipe', 'inherit'], shell: false }
  return spawn('./dist/reg-utils', args, regUtilsOptions)
}
const exitCode = (sub: ChildProcess) => new Promise<number>((ok, reject) => {
  sub.on('exit', ok)
  sub.on('error', reject)
})
const stdout = async (sub: ChildProcess) => {
  await new Promise((ok, reject) => {
    sub.on('spawn', ok)
    sub.on('error', reject)
  })
  const resp = new Response(Readable.toWeb(sub.stdout!) as any)
  return await resp.text()
}

type Browser = { name: string, args: string[] }
type BrowserList = {
  browsers: null | Record<string, Browser>
  defaultBrowser: null | string
}
export const getBrowser = async (): Promise<BrowserList> => {
  return parse(await stdout(regUtils(['browser'])))
}

let softwarePromise: Promise<string>
export const getSoftware = () => {
  softwarePromise ??= stdout(regUtils(['software']))
  return softwarePromise
}

export const getKnownFolder = async (name: string) => {
  return trim(await stdout(regUtils(['known-folder', name])))
}

export const createLnk = (arg: Record<'targetPath' | 'iconPath' | 'savePath', string>) => {
  return exitCode(regUtils(['shortcut', stringify(arg)]))
}
