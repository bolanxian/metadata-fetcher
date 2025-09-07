
import { type VNode, type Prop, defineComponent, watch, createVNode as h, shallowReactive } from 'vue'
import { Row, Col, Input, Modal, Button, ButtonGroup, Radio, RadioGroup, Checkbox } from 'view-ui-plus'
import { $then, on, encodeText } from 'bind:utils'
import { keys } from 'bind:Object'
import { type BBDownOptions, create, echo } from '../utils/bbdown'
import { removeLast } from '../bind'
const TARGET = import.meta.env.TARGET

type Xterm = InstanceType<typeof Xterm>
let Xterm: typeof import('@xterm/xterm').Terminal
let WebglAddon: typeof import('@xterm/addon-webgl').WebglAddon
let ready: Promise<void>

const $rowAttrs = { style: 'margin-bottom:24px' }
const $colAttrs0 = { span: 3, style: 'text-align:right;padding-right:8px;line-height:32px;' }
const $colAttrs1 = { span: 3, style: 'text-align:right;padding-right:8px;line-height:25px;' }
const $colAttrs2 = { span: 3, style: 'text-align:right;padding-right:8px;line-height:21px;' }
const ON_MODEL = 'onUpdate:modelValue'
const width = 864 + 32

export const BBDown = defineComponent(TARGET != 'client' ? {
  props: { id: null! as Prop<string> },
  render() {
    return h(Button, { disabled: true }, () => ['下载', null])
  }
} : {
  props: { id: null! as Prop<string> },
  data(): {
    status: null | 'ready' | 'modal' | 'terminal' | 'closed' | 'abort' | 'fading-out'
    currentId: string
    useApi: 'default' | 'tv' | 'app' | 'intl'
    input: string
  } {
    return {
      status: null,
      currentId: this.id!,
      useApi: 'default',
      input: ''
    }
  },
  setup(props, ctx) {
    const proto = create()
    const options = shallowReactive(proto)
    const setMap: Record<keyof BBDownOptions, (_: any) => void> = { __proto__: null! } as any
    for (const key of keys(proto) as (keyof BBDownOptions)[]) {
      setMap[key] = (_) => { options[key] = _ }
    }
    return {
      socket: null! as WebSocket,
      options, setMap,
      vnodeDefault: null as null | VNode[],
      vnodeFooter: null as null | VNode[],
    }
  },
  computed: {
    preview() { return echo(this.currentId, this.options) },
    modalValue() { return this.status !== 'ready' && this.status !== 'fading-out' }
  },
  mounted() {
    const vm = this
    ready ??= $then(import('@/deps/dep-xterm'), $ => {
      ({ Terminal: Xterm, WebglAddon } = $)
    })
    $then(ready, _ => {
      vm.status = 'ready'
    })
    watch(() => vm.id, id => vm.currentId = id!)
    watch(() => vm.status, status => {
      switch (status) {
        case 'ready': vm.input = ''; break
        case 'abort': vm.handleAbort(); break
      }
    })
    watch(() => vm.useApi, api => {
      const { options: opts } = vm
      opts.useTvApi = opts.useAppApi = opts.useIntlApi = false
      switch (api) {
        case 'default': break
        case 'tv': opts.useTvApi = true; break
        case 'app': opts.useAppApi = true; break
        case 'intl': opts.useIntlApi = true; break
      }
    })
  },
  methods: {
    handleModal() { this.status = 'modal' },
    handleStart() { this.status = 'terminal' },
    handleCancel() { this.status = this.status === 'terminal' ? 'abort' : 'fading-out' },
    handleHidden() { this.status = 'ready' },
    handleTerminal(vnode: VNode) {
      const vm = this
      const term: Xterm = vnode.component!.exposeProxy!.xterm
      const socket = vm.socket = new WebSocket(`./.bbdown?${new URLSearchParams({
        id: vm.currentId,
        args: JSON.stringify(vm.options)
      })}`, 'bbdown')
      const { interactive } = vm.options
      socket.binaryType = 'arraybuffer'
      on(socket, 'open', e => {
        term.write(`\x1B[1;33m开始下载 ${vm.currentId}\x1B[0m\r\n`)
        term.onData(e => {
          switch (e) {
            case '\x03': // Ctrl+C
              vm.status = 'abort'
              break
            case '\r': if (interactive) { // Enter
              const input = `${vm.input}\r\n`
              socket.send(encodeText(input))
              term.write(input)
              vm.input = ''
            } break
            case '\x7F': if (interactive) { // Backspace
              vm.input = removeLast(vm.input)
            } break
            default: if (interactive) {
              if (e >= '\x20' && e <= '\x7E' || e >= '\xA0') {
                vm.input += e
              }
            }
          }
        })
      })
      on(socket, 'message', e => {
        const { data } = e as MessageEvent<ArrayBuffer | string>
        if (typeof data === 'string') {
          term.write(data)
        } else {
          term.write(new Uint8Array(data))
        }
      })
      on(socket, 'close', e => {
        const { reason } = e as CloseEvent
        vm.status = 'closed'
        vm.socket = null!
        vm.input = ''
        if (reason) {
          const prefix = term.buffer.active.cursorX > 0 ? '\r\n' : ''
          term.write(`${prefix}\x1B[1;33m${reason}\x1B[0m\r\n`)
        }
      })
      on(socket, 'error', e => {
        const prefix = term.buffer.active.cursorX > 0 ? '\r\n' : ''
        term.write(`${prefix}\x1B[1;33m发生错误\x1B[0m\r\n`)
      })
    },
    handleAbort() {
      const term: Xterm = (this.$refs.terminal as any).xterm
      const prefix = term.buffer.active.cursorX > 0 ? '\r\n' : ''
      this.socket.send(`${prefix}\x1B[1;33m取消操作\x1B[0m\r\n`)
    }
  },
  render() {
    const vm = this, { options: opts, setMap } = vm
    return h(Button, { onClick: vm.handleModal, disabled: vm.status !== 'ready' }, () => [
      '下载',
      vm.status != null ? h(Modal, {
        width, closable: !1, maskClosable: !1,
        title: 'BBDown',
        modelValue: vm.modalValue,
        onOnHidden: vm.handleHidden
      }, {
        footer: () => [
          h(ButtonGroup, null, () => {
            let vnode: VNode[] | null = null
            switch (vm.status) {
              case 'fading-out': return vm.vnodeFooter
              case 'ready': vnode = null; break
              default: vnode = [
                h(Button, {
                  loading: vm.status === 'abort',
                  onClick: vm.handleCancel
                }, () => ['取消']),
                h(Button, {
                  type: 'primary',
                  loading: vm.status === 'terminal',
                  disabled: vm.status === 'abort',
                  onClick: vm.handleStart
                }, () => ['启动'])
              ]; break
              case 'closed': vnode = [
                h(Button, {
                  type: 'primary',
                  onClick: vm.handleCancel
                }, () => ['完成']),
              ]; break
            }
            return vm.vnodeFooter = vnode
          })
        ],
        default: () => {
          let vnode: VNode[] | null = null
          switch (vm.status) {
            case 'fading-out': return vm.vnodeDefault
            case 'ready': vnode = [
              h('div', { style: 'width:864px;height:576px' })
            ]; break
            case 'modal': vnode = [
              h(Row, $rowAttrs, () => [
                h(Col, $colAttrs0, () => ['视频地址：']),
                h(Col, { span: 9 }, () => [
                  h(Input, {
                    modelValue: vm.currentId,
                    [ON_MODEL](_: string) { vm.currentId = _ }
                  })
                ])
              ]),
              h(Row, $rowAttrs, () => [
                h(Col, $colAttrs1, () => ['解析模式：']),
                h(Col, { span: 21 }, () => [
                  h(RadioGroup, {
                    modelValue: vm.useApi,
                    [ON_MODEL](_: any) { vm.useApi = _ }
                  }, () => [
                    h(Radio, { label: 'default' }, () => ['默认']),
                    h(Radio, { label: 'tv' }, () => ['TV端']),
                    h(Radio, { label: 'app' }, () => ['APP端']),
                    h(Radio, { label: 'intl' }, () => ['国际版'])
                  ])
                ])
              ]),
              h(Row, $rowAttrs, () => [
                h(Col, { span: 21, offset: 3 }, () => [
                  h(Checkbox, {
                    modelValue: opts.interactive,
                    [ON_MODEL]: setMap.interactive
                  }, () => ['交互式选择清晰度']),
                  h(Checkbox, {
                    modelValue: opts.onlyShowInfo,
                    [ON_MODEL]: setMap.onlyShowInfo
                  }, () => ['仅解析而不进行下载']),
                  h(Checkbox, {
                    modelValue: opts.useMp4box,
                    [ON_MODEL]: setMap.useMp4box
                  }, () => ['使用MP4Box来混流'])
                ])
              ]),
              h(Row, $rowAttrs, () => [
                h(Col, $colAttrs2, () => ['仅下载：']),
                h(Col, { span: 21 }, () => [
                  h(Checkbox, {
                    modelValue: opts.videoOnly,
                    [ON_MODEL]: setMap.videoOnly
                  }, () => ['视频']),
                  h(Checkbox, {
                    modelValue: opts.audioOnly,
                    [ON_MODEL]: setMap.audioOnly
                  }, () => ['音频']),
                  h(Checkbox, {
                    modelValue: opts.danmakuOnly,
                    [ON_MODEL]: setMap.danmakuOnly
                  }, () => ['弹幕']),
                  h(Checkbox, {
                    modelValue: opts.subOnly,
                    [ON_MODEL]: setMap.subOnly
                  }, () => ['字幕']),
                  h(Checkbox, {
                    modelValue: opts.coverOnly,
                    [ON_MODEL]: setMap.coverOnly
                  }, () => ['封面'])
                ])
              ]),
              h(Row, $rowAttrs, () => [
                h(Col, $colAttrs2, () => ['跳过：']),
                h(Col, { span: 21 }, () => [
                  h(Checkbox, {
                    modelValue: opts.skipMux,
                    [ON_MODEL]: setMap.skipMux
                  }, () => ['混流步骤']),
                  h(Checkbox, {
                    modelValue: opts.skipAi,
                    [ON_MODEL]: setMap.skipAi
                  }, () => ['AI字幕'])
                ])
              ]),
              h(Row, $rowAttrs, () => [
                h(Col, $colAttrs0, () => ['预览：']),
                h(Col, { span: 21 }, () => [
                  h(Input, {
                    type: 'textarea',
                    autosize: { minRows: 12, maxRows: 12 },
                    readonly: true,
                    modelValue: vm.preview
                  })
                ])
              ])
            ]; break
            case 'terminal':
            case 'closed':
            case 'abort': vnode = [
              h(Terminal, { ref: 'terminal', onVnodeMounted: vm.handleTerminal }),
              h(Row, null, () => [
                h(Col, { span: 12, offset: 12 }, () => [
                  h(Input, { disabled: !opts.interactive, readonly: true, modelValue: vm.input })
                ])
              ])
            ]; break
          }
          return vm.vnodeDefault = vnode
        }
      }) : null
    ])
  }
})

export const Terminal = defineComponent({
  emits: ['data'],
  setup(props, { expose, emit }) {
    let term: Xterm | null
    const onVnodeMounted = (vnode: VNode) => {
      term = new Xterm()
      term.loadAddon(new WebglAddon())
      term.resize(96, 32)
      term.open(vnode.el as any)
      term.onData(e => emit('data', e))
    }
    const onVnodeBeforeUnmount = (vnode: VNode) => {
      term!.dispose()
      term = null
    }
    const write = (data: string | Uint8Array, callback?: () => void) => {
      term!.write(data, callback)
    }
    expose({ get xterm() { return term }, write })
    return () => h('div', {
      style: 'width:864px;height:544px;',
      onVnodeMounted, onVnodeBeforeUnmount
    })
  }
})