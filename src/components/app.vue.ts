
import { defineComponent, shallowReactive, toRaw, watch, watchEffect, createVNode as h, onMounted, onServerPrefetch } from 'vue'
import type { Component, Prop } from 'vue'
import { Row, Col, Input, ButtonGroup, Button, Select, Option, Modal, Message, Menu, Submenu, MenuItem } from 'view-ui-plus'
import { getOwn, test, split } from 'bind:utils'
import { assign, entries } from 'bind:Object'
import { from, join } from 'bind:Array'
import { trim, slice, startsWith, replaceAll } from 'bind:String'
import { nextTick, resolveAsHttp } from '@/bind'
import { type Config, config, config as defaultConfig, writeConfig } from '@/config'
import { type OnParsed, render as _render, renderBatch } from '@/render'
import { resolve, xparse, $fetch, getPluginComponent } from '@/meta-fetch/mod'
import type { ResolvedInfo, ParsedInfo } from '@/meta-fetch/mod'
import { Dialog } from './dialog'
import { QRCode } from './qrcode'
import './bilibili.vue'

const TARGET = import.meta.env.TARGET
const SSR = TARGET == 'server'
const CSR = TARGET == 'client'
const PAGES = TARGET == 'pages'
export const S = /\s+/, P = /^\w/
export const Data = Symbol('Data')

export interface Store {
  mode: string
  input: string

  resolved: ResolvedInfo | null
  data: {} | null
  parsed: ResolvedInfo & ParsedInfo | null

  batchResolved: string | null
  [Data]?: Data

  output: string
  config: Config
}
export type Data = ({
  mode: 'default'
  batchType: null
  batchLength: null
  dialogType: null
} | {
  mode: 'batch'
  batchType: string
  batchLength: number
  dialogType: null
} | {
  mode: 'dialog'
  batchType: null
  batchLength: null
  dialogType: 'file' | 'directory'
}) & {
  batchTitle: string
  loading: boolean
  disabled: boolean
  maybeHttp: string | null
}

const resolveBatchCb = (id: string) => resolve(id)?.id ?? '!'
const resolveBatch = (input: string) => input ? join(from(split(S, input), resolveBatchCb), ' ') : ''
export const createBatchParams = (type: string, input: string | Iterable<string>) => {
  let ids = ''
  if (typeof input == 'string') {
    ids = `&${replaceAll(encodeURIComponent(input), '%20', '&')}`
  } else for (const arg of input) {
    ids += `&${encodeURIComponent(arg)}`
  }
  return `.type=${encodeURIComponent(type)}${ids}`
}

export default defineComponent({
  props: PAGES ? (void 0)! : { store: null! as Prop<Store> },
  setup(props, { expose }) {
    const data = shallowReactive<Data>({
      mode: 'default',
      batchType: null, batchLength: null, batchTitle: '',
      dialogType: null, loading: false, disabled: true, maybeHttp: null
    })
    const handleRefOutput = (vm: any) => {
      if (vm != null) { nextTick(vm.resizeTextarea) }
    }
    if (CSR || (PAGES && $fetch != null)) {
      onMounted(() => { data.disabled = false })
    }

    let component: Component | undefined
    const $store = PAGES ? null : props.store
    const store = SSR ? $store! : shallowReactive<Store>($store ?? {
      mode: 'default',
      input: '',
      resolved: null,
      data: null,
      parsed: null,
      output: '',
      batchResolved: null,
      config: defaultConfig
    })
    if (SSR) { store[Data] = data }

    if (CSR) { assign(config, store.config) }
    store.input = trim(store.input)
    if (startsWith(store.mode, 'batch:')) {
      const type = slice(store.mode, 6)
      const name = getOwn(config.batch, type)?.name
      data.mode = 'batch'
      data.batchType = type
      data.batchTitle = `［${name || type}］`
      if (SSR) {
        store.batchResolved = ''
        store.input && onServerPrefetch(async () => {
          store.batchResolved = resolveBatch(store.input)
          const args = split(S, store.input)
          const onParsed: OnParsed = (parsed) => { store.parsed ??= parsed }
          data.batchLength = args.length
          let output = ''
          for await (const line of renderBatch(args, data.batchType!, onParsed)) {
            output += `${line.error ?? line.value}\n`
          }
          store.output = output
        })
      }
    } else if (startsWith(store.mode, 'dialog:')) {
      const type = slice(store.mode, 7)
      data.mode = 'dialog'
      data.dialogType = type as any
    } else {
      if (SSR) {
        store.input && onServerPrefetch(async () => {
          data.maybeHttp = resolveAsHttp(store.input)
          const [plugin, resolved, redirected, dataPromise, parsedPromise] = xparse(store.input)
          if (resolved == null) { return }
          component = getPluginComponent(plugin!)
          store.resolved = redirected != null ? await redirected : resolved
          store.data = await dataPromise ?? null
          if ((store.parsed = await parsedPromise ?? null) != null) {
            store.output = _render(store.parsed, store.config.template)
          }
        })
      } else {
        data.maybeHttp = store.input ? resolveAsHttp(store.input) : null
        const id = store.resolved?.id
        if (id != null) {
          const [plugin] = xparse(id)
          component = plugin != null ? getPluginComponent(plugin) : void 0
        }
      }
    }

    !SSR && watch(() => trim(store.input), input => {
      if (data.mode === 'batch') {
        store.batchResolved = ''
        store.batchResolved = resolveBatch(input)
      } else {
        store.resolved = data.maybeHttp = null
        if (input) {
          store.resolved = resolve(input)
          data.maybeHttp = resolveAsHttp(input)
        }
        if (PAGES) {
          const id = store.resolved?.id
          data.disabled = id === 'ice' ? false : $fetch == null
        }
      }
    })

    const handleSelect = PAGES ? null! : (name: string) => {
      if (data.disabled) { return }
      if (startsWith(name, 'batch:')) {
        location.href = `./.batch?${createBatchParams(slice(name, 6), resolveBatch(trim(store.input)))}`
      } else {
        const id = resolve(split(S, trim(store.input), 1)[0]!)?.id
        if (id == null || test(P, id)) {
          location.href = `./${encodeURIComponent(id ?? '')}`
        } else {
          location.href = `./.search?.=${encodeURIComponent(id)}`
        }
      }
    }
    const handleSearch = PAGES ? async () => {
      if (data.disabled) { return }
      try {
        data.loading = true
        store.output = ''
        if (data.mode === 'batch') {
          for await (const line of renderBatch(split(S, store.batchResolved!), data.batchType)) {
            store.output += `${line.error ?? line.value}\n`
          }
        } else if (store.resolved != null) {
          const { id } = store.resolved
          if (id[0] === '@') { return }
          const [plugin, resolved, , dataPromise, parsedPromise] = xparse(trim(store.input))
          component = getPluginComponent(plugin!)
          store.resolved = resolved!
          store.data = await dataPromise!
          if ((store.parsed = await parsedPromise!) != null) {
            store.output = _render(store.parsed, store.config.template)
          }
        }
      } catch (error) {
        component = void 0
        store.data = null
        store.parsed = null
        store.output = ''
        throw error
      } finally {
        data.loading = false
      }
    } : CSR ? () => {
      if (data.disabled) { return }
      if (data.mode === 'batch') {
        location.href = `./.batch?${createBatchParams(data.batchType, store.batchResolved!)}`
      } else if (store.resolved != null) {
        const { id } = store.resolved
        if (test(P, id)) {
          location.href = `./${encodeURIComponent(id)}`
        } else {
          location.href = `./.search?.=${encodeURIComponent(id)}`
        }
      }
    } : null!

    const handleFocus = !SSR ? (e: FocusEvent) => {
      (e.target as HTMLInputElement).select()
    } : null!
    const handleOk = async (data: any) => {
      let ok = false
      try {
        ok = await writeConfig(data)
      } finally {
        if (ok) {
          if (!PAGES) { location.reload(); return }
          assign(store.config, data)
          store.output = store.parsed != null ? _render(store.parsed, store.config.template) : ''
        } else {
          Message['error']('失败')
        }
      }
    }
    !SSR ? expose({ __proto__: toRaw(props), data }) : null!
    const $colAttrs0 = { xs: 24, sm: { span: 20, offset: 2 }, md: { span: 16, offset: 4 }, lg: { span: 12, offset: 6 } }
    const $colAttrs1 = { xs: 24, sm: 12, md: { span: 11, offset: 1 }, lg: { span: 10, offset: 2 } }
    const $colAttrs2 = { xs: 24, sm: 12, md: 11, lg: 10 }
    return () => [
      h('div', { style: 'margin:60px auto 40px auto;text-align:center' }, [
        h('h2', null, ['\u3000'])
      ]),
      h(Row, { gutter: 8 }, () => [
        h(Col, (store.data, component != null) ? $colAttrs1 : $colAttrs0, () => [
          !PAGES ? h(Menu, {
            style: 'margin-left:8px;margin-right:8px;z-index:1000',
            mode: 'horizontal',
            activeName: store.mode,
            onOnSelect: handleSelect
          }, () => [
            h(MenuItem, { name: 'default' }, () => ['元数据']),
            h(Submenu, { name: 'batch' }, {
              title: () => ['批量模式', data.batchTitle],
              default: () => from(entries(config.batch), ([key, { name }]) =>
                h(MenuItem, { name: `batch:${key}`, style: name ? null : 'display:none' }, () => [name || key])
              )
            })
          ]) : null,
          h(Input, {
            modelValue: store.input,
            'onUpdate:modelValue'(value: string) { store.input = value },
            onOnEnter: handleSearch
          }, {
            prepend: () => data.maybeHttp != null
              ? h(QRCode, { icon: 'ios-globe-outline', text: `https://${data.maybeHttp}` })
              : h(QRCode, { icon: 'ios-search', text: store.input }),
            append: () => {
              const disabled = data.disabled || (store.resolved == null && store.batchResolved == null)
              return h(Button, {
                icon: disabled ? 'md-help' : 'md-arrow-forward',
                loading: data.loading, disabled,
                onClick: handleSearch
              })
            }
          }),
          data.mode === 'default' ? h(Input, {
            modelValue: store.resolved?.url ?? '',
            onOnFocus: handleFocus,
            readonly: true
          }, {
            prepend: () => h(QRCode, { icon: 'md-link', text: store.resolved?.url ?? '' }),
          }) : null,
          data.mode === 'default' ? h(Input, {
            style: store.resolved?.shortUrl ? null : 'display:none',
            modelValue: store.resolved?.shortUrl ?? '',
            onOnFocus: handleFocus,
            readonly: true
          }, {
            prepend: () => h(QRCode, { icon: 'md-share', text: store.resolved?.shortUrl ?? '' }),
          }) : null,
          data.mode === 'batch' ? h(Input, {
            modelValue: store.batchResolved,
            onOnFocus: handleFocus,
            readonly: true
          }) : null,
          SSR || CSR || (PAGES && !data.disabled) ? PAGES || (CSR && !data.disabled) ? h(Input, {
            ref: handleRefOutput,
            style: 'margin-top:20px',
            type: 'textarea',
            autosize: { minRows: 20, maxRows: 1 / 0 },
            modelValue: store.output,
            readonly: true
          }) : h('div', { class: 'ivu-input-wrapper', style: 'margin-top:20px' }, [
            h('textarea', { class: 'ivu-input', style: 'min-height:430px', readonly: true }, [store.output])
          ]) : null,
          (CSR || PAGES) && !data.disabled
            ? h(Config, { config: store.config, handleOk })
            : null
        ]),
        component != null ? h(Col, $colAttrs2, () => [
          h(component!, { data: store.data })
        ]) : null
      ]),
      CSR && !data.disabled && data.mode === 'dialog'
        ? h(Dialog, { type: data.dialogType, path: store.input })
        : null
    ]
  }
})

const Config = defineComponent({
  props: { config: null! as Prop<Config>, handleOk: null! as Prop<(data: any) => any> },
  setup(props, ctx) {
    const data = shallowReactive<{
      status: undefined | null | 'modal' | 'pending'
    }>({
      status: void 0
    })
    const config = shallowReactive(props.config!)
    const handleOk = () => { data.status = 'pending' }
    const handleCancel = () => { data.status = null }
    const handleHidden = () => { data.status = void 0 }
    const handleModal = () => {
      if (data.status == null) {
        data.status = null
        nextTick(() => { data.status = 'modal' })
      }
    }
    const handleProcess = async () => {
      try { await props.handleOk!(config) }
      finally { data.status = null }
    }
    watchEffect(() => {
      if (data.status === 'pending') { handleProcess() }
    })
    const $rowAttrs = { style: 'margin-bottom:24px' }
    const $colAttrs0 = { span: 6, style: 'text-align:right;padding-right:8px;line-height:32px;' }
    const $colAttrs1 = { span: 18 }
    return () => [
      h(Button, {
        style: 'margin:20px 0',
        disabled: data.status != null,
        onClick: handleModal
      }, () => ['设置']),
      data.status !== void 0 ? h(Modal, {
        width: 512, closable: !1, maskClosable: !1, transfer: true,
        title: '设置',
        modelValue: data.status != null,
        onOnHidden: handleHidden
      }, {
        footer: () => [
          h(ButtonGroup, null, () => [
            h(Button, {
              disabled: data.status === 'pending',
              onClick: handleCancel
            }, () => ['取消']),
            h(Button, {
              type: 'primary',
              loading: data.status === 'pending',
              onClick: handleOk
            }, () => ['确定'])
          ])
        ],
        default: () => [
          h(Row, $rowAttrs, () => [
            h(Col, $colAttrs0, () => ['浏览器：']),
            h(Col, $colAttrs1, () => [
              h(Select, {
                transfer: true,
                disabled: config.browsers == null,
                modelValue: config.defaultBrowser,
                'onUpdate:modelValue'(_: any) { config.defaultBrowser = _ }
              }, () => config.browsers != null ? from(entries(config.browsers), ([key, { name, args }]) => h(Option, {
                value: key, disabled: args == null
              }, () => [name])) : null)
            ])
          ]),
          h(Row, $rowAttrs, () => [
            h(Col, $colAttrs0, () => ['Niconico链接：']),
            h(Col, $colAttrs1, () => [
              h(Select, {
                transfer: true,
                modelValue: config.nicoUrlType,
                'onUpdate:modelValue'(_: any) { config.nicoUrlType = _ }
              }, () => [
                h(Option, { value: 'watch' }, () => ['默认']),
                h(Option, { value: 'tree' }, () => ['ニコニ･コモンズ'])
              ])
            ])
          ]),
          h(Row, $rowAttrs, () => [
            h(Col, $colAttrs0, () => ['分隔符：']),
            h(Col, $colAttrs1, () => [
              h(Input, {
                modelValue: config.separator,
                'onUpdate:modelValue'(_: any) { config.separator = _ }
              })
            ])
          ]),
          h(Row, $rowAttrs, () => [
            h(Col, $colAttrs0, () => ['模板：']),
            h(Col, $colAttrs1, () => [
              h(Input, {
                type: 'textarea',
                autosize: { minRows: 12, maxRows: 12 },
                modelValue: config.template,
                'onUpdate:modelValue'(_: any) { config.template = _ }
              })
            ])
          ])
        ]
      }) : null
    ]
  }
})
