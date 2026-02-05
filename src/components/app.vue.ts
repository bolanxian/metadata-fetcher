
import { defineComponent, shallowReactive, toRaw, watch, createVNode as h, onMounted } from 'vue'
import type { Component, Prop } from 'vue'
import { Row, Col, Input, Button, Message, Menu, Submenu, MenuItem } from 'view-ui-plus'
import { type Override, getOwn, test, split } from 'bind:utils'
import { assign, entries } from 'bind:Object'
import { from, join } from 'bind:Array'
import { trim, slice, startsWith, replaceAll } from 'bind:String'
import { nextTick, resolveAsHttp } from '@/bind'
import { type Config, config, writeConfig } from '@/config'
import { type OnParsed, render as _render, renderBatch } from '@/render'
import { resolve, xparse, getPluginComponent } from '@/meta-fetch/mod'
import type { ResolvedInfo, ParsedInfo } from '@/meta-fetch/mod'
import ConfigVue from './config.vue'
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
  mode: 'default' | `batch:${string}` | `dialog:${DataDialog['dialogType']}`
  input: string

  resolved: ResolvedInfo | null
  data: {} | null
  parsed: ResolvedInfo & ParsedInfo | null

  output: string
  config: Config
  [Data]: Data | null
}

type DataDefault = {
  mode: 'default'
  batchType: null
  batchLength: null
  batchTitle: null
  batchResolved: null
  dialogType: null
}
type DataBatch = Override<DataDefault, {
  mode: 'batch'
  batchType: string
  batchLength: number
  batchTitle: string
  batchResolved: string
}>
type DataDialog = Override<DataDefault, {
  mode: 'dialog'
  dialogType: 'file' | 'directory'
}>

export type Data = (DataDefault | DataBatch | DataDialog) & {
  loading: boolean
  disabled: boolean
  maybeHttp: string | null
  component: Component | undefined
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

export const createStore = (mode: string, input: string): Store => {
  const store: Store = {
    mode: mode as any, input: trim(input),
    resolved: null, data: null, parsed: null,
    output: '', config, [Data]: null
  }
  return store
}
export const createData = (store: Store): Data => {
  const data = {
    mode: 'default',
    batchType: null,
    batchLength: null,
    batchTitle: null,
    batchResolved: null,
    dialogType: null,
    loading: false,
    disabled: true,
    maybeHttp: null,
    component: void 0,
  } satisfies Data as Data
  if (startsWith(store.mode, 'batch:')) {
    const type = slice(store.mode, 6)
    const name = getOwn(config.batch, type)?.name
    data.mode = 'batch'
    data.batchType = type
    data.batchTitle = `［${name || type}］`
    data.batchResolved = resolveBatch(store.input)
  } else if (startsWith(store.mode, 'dialog:')) {
    data.mode = 'dialog'
    data.dialogType = slice(store.mode, 7) as any
  } else {
    if (!SSR) {
      data.maybeHttp = store.input ? resolveAsHttp(store.input) : null
      const id = store.resolved?.id
      if (id != null) {
        const [plugin] = xparse(id)
        data.component = plugin != null ? getPluginComponent(plugin) : void 0
      }
    }
  }
  return data
}
export const prefetchStore = async (store: Store) => {
  const data = store[Data]!
  switch (data.mode) {
    default: {
      data.maybeHttp = resolveAsHttp(store.input)
      const [plugin, resolved, redirected, dataPromise, parsedPromise] = xparse(store.input)
      if (resolved == null) { return }
      data.component = getPluginComponent(plugin!)
      store.resolved = redirected != null ? await redirected : resolved
      store.data = await dataPromise ?? null
      if ((store.parsed = await parsedPromise ?? null) != null) {
        store.output = _render(store.parsed, store.config.template)
      }
    } return
    case 'batch': {
      const args = split(S, store.input)
      const onParsed: OnParsed = (parsed) => { store.parsed ??= parsed }
      data.batchLength = args.length
      let output = ''
      for await (const line of renderBatch(args, data.batchType!, onParsed)) {
        output += `${line.error ?? line.value}\n`
      }
      store.output = output
    } return
    case 'dialog':
      return
  }
}

export default defineComponent({
  props: PAGES ? (void 0)! : { store: null! as Prop<Store> },
  setup(props, { expose }) {
    const store: Store = SSR
      ? props.store!
      : shallowReactive(CSR ? props.store! : createStore('default', ''))
    const data: Data = SSR
      ? store[Data]!
      : shallowReactive(createData(store))

    CSR && onMounted(() => { data.disabled = false })
    !SSR && expose({ __proto__: toRaw(props), data })
    !SSR && watch(() => trim(store.input), input => {
      if (data.mode === 'batch') {
        data.batchResolved = resolveBatch(input)
      } else {
        store.resolved = data.maybeHttp = null
        if (input) {
          store.resolved = resolve(input)
          data.maybeHttp = resolveAsHttp(input)
        }
      }
    })
    const handleRefOutput = (vm: any) => {
      if (vm != null) { nextTick(vm.resizeTextarea) }
    }
    const handleSelect = CSR ? (name: string) => {
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
    } : null!
    const handleSearch = CSR ? () => {
      if (data.disabled) { return }
      if (data.mode === 'batch') {
        location.href = `./.batch?${createBatchParams(data.batchType, data.batchResolved)}`
      } else if (store.resolved != null) {
        const { id } = store.resolved
        if (test(P, id)) {
          location.href = `./${encodeURIComponent(id)}`
        } else {
          location.href = `./.search?.=${encodeURIComponent(id)}`
        }
      }
    } : PAGES ? async () => {
      const id = store.resolved?.id
      if (data.disabled = id !== 'ice') { return }
      const [, , , , parsedPromise] = xparse(store.input)
      if ((store.parsed = await parsedPromise ?? null) != null) {
        store.output = _render(store.parsed, store.config.template)
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

    const $colAttrs0 = { xs: 24, sm: { span: 20, offset: 2 }, md: { span: 16, offset: 4 }, lg: { span: 12, offset: 6 } }
    const $colAttrs1 = { xs: 24, sm: 12, md: { span: 11, offset: 1 }, lg: { span: 10, offset: 2 } }
    const $colAttrs2 = { xs: 24, sm: 12, md: 11, lg: 10 }
    return () => [
      h('div', { style: 'margin:60px auto 40px auto;text-align:center' }, [
        h('h2', null, ['\u3000'])
      ]),
      h(Row, { gutter: 8 }, () => [
        h(Col, data.component != null ? $colAttrs1 : $colAttrs0, () => [
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
              const disabled = SSR ? true : (
                (!PAGES && data.disabled) || (store.resolved == null && data.batchResolved == null)
              )
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
            modelValue: data.batchResolved,
            onOnFocus: handleFocus,
            readonly: true
          }) : null,
          SSR || CSR || (PAGES && !data.disabled)
            ? PAGES || (CSR && !data.disabled)
              ? h(Input, {
                ref: handleRefOutput,
                style: 'margin-top:20px',
                type: 'textarea',
                autosize: { minRows: 20, maxRows: 1 / 0 },
                modelValue: store.output,
                readonly: true
              })
              : h('div', { class: 'ivu-input-wrapper', style: 'margin-top:20px' }, [
                h('textarea', { class: 'ivu-input', style: 'min-height:430px', readonly: true }, [store.output])
              ])
            : null,
          (CSR || PAGES) && !data.disabled
            ? h(ConfigVue, { config: store.config, handleOk })
            : null
        ]),
        data.component != null ? h(Col, $colAttrs2, () => [
          h(data.component!, { data: store.data })
        ]) : null
      ]),
      CSR && !data.disabled && data.mode === 'dialog'
        ? h(Dialog, { type: data.dialogType, path: store.input })
        : null
    ]
  }
})
