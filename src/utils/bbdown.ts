
import { userAgent } from '../plugin'
import { $string, $array, on, pipeTo } from '../bind'
const { includes } = $string, { join } = $array
const { error } = console

export interface BBDownOptions {
  /** 使用TV端解析模式 */
  useTvApi: boolean
  /** 使用APP端解析模式 */
  useAppApi: boolean
  /** 使用国际版(东南亚视频)解析模式 */
  useIntlApi: boolean
  /** 使用MP4Box来混流 */
  useMp4box: boolean
  /** 仅解析而不进行下载 */
  onlyShowInfo: boolean
  /** 交互式选择清晰度 */
  interactive: boolean
  /** 跳过混流步骤 */
  skipMux: boolean
}

export const create = (): BBDownOptions => {
  return {
    useTvApi: !1,
    useAppApi: !1,
    useIntlApi: !1,
    useMp4box: !1,
    onlyShowInfo: !1,
    interactive: !1,
    skipMux: !1
  }
}

const filePattern = '[<ownerName>][av<aid>]<videoTitle>'
const multiFilePattern = `${filePattern}/[P<pageNumberWithZero>]<pageTitle>`
export function* xargs(opts: BBDownOptions): Generator<string, void, void> {
  if (opts.useTvApi) { yield '--use-tv-api' }
  if (opts.useAppApi) { yield '--use-app-api' }
  if (opts.useIntlApi) { yield '--use-intl-api' }
  if (opts.useMp4box) { yield '--use-mp4box' }
  if (opts.onlyShowInfo) { yield '--only-show-info' }
  if (opts.interactive) { yield '--interactive' }
  if (opts.skipMux) { yield '--skip-mux' }
  yield '--file-pattern'
  yield filePattern
  yield '--multi-file-pattern'
  yield multiFilePattern
  yield '--user-agent'
  yield userAgent
}

export const echo = (id: string, opts: BBDownOptions) => {
  if (includes(id, ' ')) { id = `"${id}"` }
  let ret: string[] = [id]
  for (let arg of xargs(opts)) {
    if (includes(arg, ' ')) { arg = `"${arg}"` }
    ret[ret.length] = arg
  }
  return `bbdown ${join(ret, ' ')}`
}

export const handleRequest = (request: Request, cwd: string) => {
  if (!import.meta.env.SSR) { return null! }
  const { searchParams } = new URL(request.url)
  let id: string = null!, args: BBDownOptions = null!
  try {
    id = searchParams.get('id')!
    args = JSON.parse(searchParams.get('args')!)
  } catch { }
  if (id == null || args == null) { return null }

  const { socket, response } = Deno.upgradeWebSocket(request, { protocol: 'bbdown' })
  socket.binaryType = 'arraybuffer'
  const command = new Deno.Command('bbdown', {
    args: [id, ...xargs(args)], cwd,
    stdin: 'piped', stdout: 'piped', stderr: 'inherit'
  })
  let process: Deno.ChildProcess
  let code: number
  on(socket, 'open', e => {
    process = command.spawn()
    pipeTo(stdin, process.stdin)
    pipeTo(process.stdout, stdout)
    process.status.then((status) => {
      code = status.code
      socket.close(code != 0 ? 4000 : 1000, code > 0 ? `进程未成功退出（退出代码：${code}）` : '')
    })
    socket.send(`> ${echo(id, args)}\r\n`)
  })
  const stdin = new ReadableStream({
    start(controller) {
      on(socket, 'message', e => {
        const { data } = e as MessageEvent<ArrayBuffer | string>
        if (typeof data === 'string') {
          process.kill('SIGKILL')
        } else {
          controller.enqueue(new Uint8Array(data))
        }
      })
    }
  })
  const stdout = new WritableStream({
    write(chunk, controller) {
      socket.send(chunk)
    }
  })
  on(socket, 'close', e => {
    if (process != null && code == null) {
      process.kill('SIGKILL')
    }
  })
  on(socket, 'error', e => { error('错误: socket<bbdown>') })
  return response
}