
import { Terminal as Xterm } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { defineComponent, watch, createVNode as h, shallowReactive } from 'vue'
import { Row, Col, Input, Modal, Button, ButtonGroup, Radio, RadioGroup, Checkbox } from 'view-ui-plus'
import { create, echo } from '../utils/bbdown'
import { on, encodeText, removeLast } from '../bind'
const delay = (t: number) => new Promise(ok => { setTimeout(ok, t) })
const $rowAttrs = { style: 'margin-bottom:24px' }
const $colAttrs0 = { span: 3, style: 'text-align:right;padding-right:8px;line-height:32px;' }

export const BBDown = defineComponent({
  props: { id: String },
  data(): {
    status: null | 'ready' | 'modal' | 'terminal' | 'closed' | 'abort'
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
    return {
      socket: null! as WebSocket,
      options: shallowReactive(create())
    }
  },
  computed: {
    preview() { return echo(this.currentId, this.options) }
  },
  mounted() {
    const vm = this
    watch(() => vm.id, id => vm.currentId = id!)
    watch(() => vm.status, status => {
      switch (status) {
        case 'ready': vm.input = ''; break
        case 'terminal': vm.handleTerminal(); break
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
    vm.status = 'ready'
  },
  methods: {
    handleModal() { this.status = 'modal' },
    handleStart() { this.status = 'terminal' },
    handleCancel() { this.status = this.status === 'terminal' ? 'abort' : 'ready' },
    async handleTerminal() {
      await delay(0); const vm = this
      const term: Xterm = (vm.$refs.terminal as any).xterm
      const socket = vm.socket = new WebSocket(`./.bbdown?${new URLSearchParams({
        id: vm.currentId,
        args: JSON.stringify(vm.options)
      })}`, 'bbdown')
      socket.binaryType = 'arraybuffer'
      on(socket, 'open', e => {
        term.write(`\x1B[1;33m开始下载 ${vm.currentId}\x1B[0m\r\n`)
        term.onData(e => {
          switch (e) {
            case '\x03': // Ctrl+C
              vm.status = 'abort'
              break
            case '\r': { // Enter
              const input = `${vm.input}\r\n`
              socket.send(encodeText(input))
              term.write(input)
              vm.input = ''
            } break
            case '\x7F': // Backspace
              vm.input = removeLast(vm.input)
              break
            default:
              if (e >= '\x20' && e <= '\x7E' || e >= '\xA0') {
                vm.input += e
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
    async handleAbort() {
      const term: Xterm = (this.$refs.terminal as any).xterm
      const prefix = term.buffer.active.cursorX > 0 ? '\r\n' : ''
      term.write(`${prefix}\x1B[1;33m取消操作\x1B[0m\r\n`)
      this.socket.send('\x03')
    }
  },
  render() {
    const vm = this, { options: opts } = vm
    return h(Button, { onClick: vm.handleModal, disabled: vm.status != 'ready' }, () => [
      '下载',
      vm.status != null ? h(Modal, {
        width: 864 + 32, closable: !1, maskClosable: !1,
        title: 'BBDown',
        modelValue: vm.status != 'ready'
      }, {
        footer: () => [
          h(ButtonGroup, null, () => {
            switch (vm.status) {
              case 'ready': return null
              default: return [
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
              ]
              case 'closed': return [
                h(Button, {
                  type: 'primary',
                  onClick: vm.handleCancel
                }, () => ['完成']),
              ]
            }
          })
        ],
        default: () => {
          switch (vm.status) {
            case 'ready': return [
              h('div', { style: 'width:864px;height:576px' })
            ]
            case 'modal': return [
              h(Row, $rowAttrs, () => [
                h(Col, $colAttrs0, () => ['视频地址：']),
                h(Col, { span: 9 }, () => [
                  h(Input, {
                    modelValue: vm.currentId,
                    'onUpdate:modelValue'(_: string) { vm.currentId = _ }
                  })
                ])
              ]),
              h(Row, $rowAttrs, () => [
                h(Col, $colAttrs0, () => ['解析模式：']),
                h(Col, { span: 21 }, () => [
                  h(RadioGroup, {
                    modelValue: vm.useApi,
                    'onUpdate:modelValue'(_: any) { vm.useApi = _ }
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
                    'onUpdate:modelValue'(_: any) { opts.interactive = _ }
                  }, () => ['交互式选择清晰度']),
                  h(Checkbox, {
                    modelValue: opts.onlyShowInfo,
                    'onUpdate:modelValue'(_: any) { opts.onlyShowInfo = _ }
                  }, () => ['仅解析而不进行下载']),
                  h(Checkbox, {
                    modelValue: opts.skipMux,
                    'onUpdate:modelValue'(_: any) { opts.skipMux = _ }
                  }, () => ['跳过混流步骤']),
                  h(Checkbox, {
                    modelValue: opts.useMp4box,
                    'onUpdate:modelValue'(_: any) { opts.useMp4box = _ }
                  }, () => ['使用MP4Box来混流'])
                ])
              ]),
              h(Row, $rowAttrs, () => [
                h(Col, $colAttrs0, () => ['预览：']),
                h(Col, { span: 21 }, () => [
                  h(Input, {
                    type: 'textarea',
                    autosize: { minRows: 16, maxRows: 16 },
                    readonly: true,
                    modelValue: vm.preview
                  })
                ])
              ])
            ]
            case 'terminal':
            case 'closed':
            case 'abort': return [
              h(Terminal, { ref: 'terminal' }),
              h(Row, null, () => [
                h(Col, { span: 12, offset: 12 }, () => [
                  h(Input, {
                    readonly: true,
                    modelValue: vm.input
                  })
                ])
              ])
            ]
          }
          return null
        }
      }) : null
    ])
  }
})

export const Terminal = defineComponent({
  setup(props, ctx) {
    return { xterm: null! as Xterm }
  },
  mounted() {
    const term = this.xterm = new Xterm()
    term.loadAddon(new WebglAddon())
    term.resize(96, 32)
    term.open(this.$el)
  },
  beforeUnmount() {
    this.xterm.dispose()
  },
  render() {
    return h('div', { style: 'width:864px;height:544px;' })
  }
})