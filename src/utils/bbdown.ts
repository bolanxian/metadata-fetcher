
import { pipeTo, test, on } from 'bind:utils'
import { replaceAll } from 'bind:String'
import { join } from 'bind:Array'
import { defaultUserAgent as userAgent } from '@/meta-fetch/mod'
const { error } = console

const $command = 'bbdown'
const notExists = `\
找不到 BBDown\r
BBDown是一个免费且便捷高效的哔哩哔哩下载/解析软件.\r
https://github.com/nilaoda/BBDown/ \r
`

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
  /** 仅下载视频 */
  videoOnly: boolean
  /** 仅下载音频 */
  audioOnly: boolean
  /** 仅下载弹幕 */
  danmakuOnly: boolean
  /** 仅下载字幕 */
  subOnly: boolean
  /** 仅下载封面 */
  coverOnly: boolean
  /** 跳过混流步骤 */
  skipMux: boolean
  /** 跳过AI字幕下载(默认开启) */
  skipAi: boolean
}

export const create = (): BBDownOptions => {
  return {
    useTvApi: !1,
    useAppApi: !1,
    useIntlApi: !1,
    useMp4box: !1,
    onlyShowInfo: !1,
    interactive: !1,
    videoOnly: !1,
    audioOnly: !1,
    danmakuOnly: !1,
    subOnly: !1,
    coverOnly: !1,
    skipMux: !1,
    skipAi: !0,
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
  if (opts.videoOnly) { yield '--video-only' }
  if (opts.audioOnly) { yield '--audio-only' }
  if (opts.danmakuOnly) { yield '--danmaku-only' }
  if (opts.subOnly) { yield '--sub-only' }
  if (opts.coverOnly) { yield '--cover-only' }
  if (opts.skipMux) { yield '--skip-mux' }
  if (!opts.skipAi) { yield '--skip-ai'; yield 'false' }
  yield '--file-pattern'
  yield filePattern
  yield '--multi-file-pattern'
  yield multiFilePattern
  yield '--user-agent'
  yield userAgent
}

export const escape = (str: string) => {
  if (!test(/^[-=\w]*$/, str)) {
    str = `"${replaceAll(str, '"', '\\"')}"`
  }
  return str
}
export const echo = (id: string, opts: BBDownOptions) => {
  let ret = [$command, escape(id)]
  for (let arg of xargs(opts)) {
    ret[ret.length] = escape(arg)
  }
  return join(ret, ' ')
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

  const { socket, response } = Deno.upgradeWebSocket(request, { protocol: $command })
  socket.binaryType = 'arraybuffer'
  const aborter = new AbortController()
  const { signal } = aborter, options = { signal }
  let command: Deno.Command
  let process: Deno.ChildProcess
  let code: number
  const handleOpen = async (e: Event) => {
    try {
      command = new Deno.Command($command, {
        args: [id, ...xargs(args)], cwd, signal,
        stdin: 'piped', stdout: 'piped', stderr: 'inherit'
      })
      process = command.spawn()
      pipeTo(stdin, process.stdin)
      pipeTo(process.stdout, stdout, options)
      socket.send(`> ${echo(id, args)}\r\n`)
      const status = await process.status
      code = status.code
    } catch (e: any) {
      if (process == null && e?.code === 'ENOENT') {
        socket.send(notExists)
      } else {
        error(e)
      }
    } finally {
      let reason = ''
      if (code == null) { reason = '进程未成功启动' }
      else if (code !== 0) { reason = `进程未成功退出（退出代码：${code}）` }
      socket.close(code !== 0 ? 4000 : 1000, reason)
    }
  }
  const stdin = new ReadableStream({
    start(controller) {
      on(socket, 'message', e => {
        const { data } = e as MessageEvent<ArrayBuffer | string>
        if (typeof data === 'string') {
          socket.close(4000, data)
        } else {
          controller.enqueue(new Uint8Array(data))
        }
      }, options)
    }
  })
  const stdout = new WritableStream({
    write(chunk, controller) {
      socket.send(chunk)
    }
  })
  on(socket, 'open', e => { handleOpen(e) }, options)
  on(socket, 'close', e => { aborter.abort() }, options)
  on(socket, 'error', e => { error('错误: socket<bbdown>') }, options)
  return response
}