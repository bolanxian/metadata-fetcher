
import { defineComponent, shallowReactive, toRaw, watch, watchEffect, createVNode as h, onMounted, onServerPrefetch } from 'vue'
import type { Component, Prop } from 'vue'
import { Row, Col, Icon, Input, ButtonGroup, Button, Select, Option, Modal, Message } from 'view-ui-plus'
import { split } from 'bind:utils'
import { assign, entries } from 'bind:Object'
import { from, map } from 'bind:Array'
import { trim, slice, indexOf, startsWith } from 'bind:String'
import { nextTick } from '../bind'
import { type Config, config as defaultConfig, writeConfig } from '../config'
import {
  resolve, xparse, render as _render, renderBatch, $fetch
} from '../plugin'
import type { ResolvedInfo, ParsedInfo } from '../plugin'
import.meta.glob('../plugins/*', { eager: true })

const TARGET = import.meta.env.TARGET
const SSR = TARGET == 'server'
const PAGES = TARGET == 'pages'
const S = /\s+/

export interface Store {
  input: string
  resolved: ResolvedInfo | null
  data: {} | null
  parsed: ParsedInfo | null
  output: string
  config: Config
}

export default defineComponent({
  props: PAGES ? (void 0)! : { store: null! as Prop<Store> },
  setup(props, { expose }) {
    const data = shallowReactive({ loading: false, disabled: true })
    const handleRefOutput = (vm: any) => { nextTick(vm.resizeTextarea) }
    if (!(PAGES && $fetch == null) && !SSR) {
      onMounted(() => { data.disabled = false })
    }

    let component: Component | undefined
    const $store = PAGES ? null : props.store
    const store = SSR ? $store! : shallowReactive($store ?? {
      input: '',
      resolved: null,
      data: null,
      parsed: null,
      output: '',
      config: defaultConfig
    })

    SSR && store.input && onServerPrefetch(async () => {
      if (store.resolved != null) {
        store.output = ''
        const { id, url } = store.resolved
        for await (const line of renderBatch(split(S, url), slice(id, 1))) {
          store.output += `${line}\n`
        }
        return
      }
      const [plugin, resolved, redirected, dataPromise, parsedPromise] = xparse(store.input)
      if (resolved == null) { return }
      component = plugin!.component
      store.resolved = redirected != null ? await redirected : resolved
      store.data = await dataPromise!
      if ((store.parsed = await parsedPromise!) != null) {
        store.output = _render(store.parsed, store.config.template)
      }
    })
    if (!SSR) {
      const id = store.resolved?.id
      if (id != null && id[0] !== '.') {
        const [plugin] = xparse(id)
        component = plugin?.component
      }
    }
    !SSR && watch(() => store.input, input => {
      try {
        input = trim(input)
        let id: string | null = null
        switch (slice(input, 0, indexOf(input, ' '))) {
          case 'id': case '!': case '.id': id = '..id'; break
          case 'list': case '!!': id = '.list'; break
          case 'name': case '=': id = '.name'; break
          case 'escape': case '==': id = '.escape'; break
        }
        if (id != null) {
          const [, ...args] = split(S, input)
          let ret = ''
          for (const arg of args) {
            ret += `${resolve(arg)?.id ?? '!'} `
          }
          store.resolved = { id, rawId: id, shortUrl: '', url: trim(ret) }
        } else {
          store.resolved = resolve(input)
        }
      } catch (error) {
        store.resolved = null
      }
    })

    const handleSearch = PAGES ? async () => {
      if (data.disabled || store.resolved == null) { return }
      try {
        data.loading = true
        store.output = ''
        const { id, url } = store.resolved
        if (id[0] === '.') {
          for await (const line of renderBatch(split(S, url), slice(id, 1))) {
            store.output += `${line}\n`
          }
        } else {
          if (startsWith(id, '@redirect!')) { return }
          const [plugin, resolved, , dataPromise, parsedPromise] = xparse(store.input)
          component = plugin!.component
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
    } : !SSR ? () => {
      if (data.disabled || store.resolved == null) { return }
      const { id, url } = store.resolved
      if (id[0] === '.') {
        location.href = `./.batch?${new URLSearchParams([
          ['type', slice(id, 1)],
          ...map(split(S, url), arg => ['id', arg]) as any[]
        ])}`
      } else if (startsWith(id, '@redirect!')) {
        location.href = `./.redirect?url=${encodeURIComponent(url)}`
      } else {
        location.href = `./${encodeURIComponent(id)}`
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
          if (!PAGES) { location.href += ''; return }
          assign(store.config, data)
          store.output = store.parsed != null ? _render(store.parsed, store.config.template) : ''
        } else {
          Message.error('失败')
        }
      }
    }
    !SSR ? expose({ __proto__: toRaw(props), data }) : null!
    return () => [
      h('div', { style: 'margin:60px auto 40px auto;text-align:center' }, [
        h('h2', null, ['\u3000'])
      ]),
      h(Row, {}, () => [
        h(Col, (store.data, component != null) ? { xs: 0, sm: 0, md: 1, lg: 2 } : { xs: 0, sm: 2, md: 4, lg: 6 }),
        h(Col, component != null ? { xs: 24, sm: 12, md: 11, lg: 10 } : { xs: 24, sm: 20, md: 16, lg: 12 }, () => [
          h(Input, {
            modelValue: store.input,
            'onUpdate:modelValue'(value: string) { store.input = value },
            onOnEnter: handleSearch
          }, {
            append: () => h(Button, {
              icon: 'md-arrow-forward',
              loading: data.loading,
              disabled: data.disabled || store.resolved == null,
              onClick: handleSearch
            })
          }),
          h(Input, {
            modelValue: store.resolved?.url ?? '',
            onOnFocus: handleFocus,
            readonly: true
          }, {
            prepend: () => h(Icon, { type: 'md-link' }),
          }),
          h(Input, {
            style: store.resolved?.shortUrl ? null : 'display:none',
            modelValue: store.resolved?.shortUrl ?? '',
            onOnFocus: handleFocus,
            readonly: true
          }, {
            prepend: () => h(Icon, { type: 'md-share' }),
          }),
          !(PAGES && $fetch == null) ? !(SSR || data.disabled) ? h(Input, {
            ref: handleRefOutput,
            style: 'margin-top:20px',
            type: 'textarea',
            autosize: { minRows: 20, maxRows: 1 / 0 },
            modelValue: store.output,
            readonly: true
          }) : h('div', { class: 'ivu-input-wrapper', style: 'margin-top:20px' }, [
            h('textarea', { class: 'ivu-input', style: 'min-height:430px', readonly: true }, [store.output])
          ]) : null,
          !(PAGES && $fetch == null) && !(SSR || data.disabled)
            ? h(Config, { config: store.config, handleOk })
            : null
        ]),
        component != null ? h(Col, { xs: 24, sm: 12, md: 11, lg: 10 }, () => [
          h(component!, { data: store.data })
        ]) : null
      ])
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
    const vm = data
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
    const $colAttrs0 = { span: 5, style: 'text-align:right;padding-right:8px;line-height:32px;' }
    return () => [
      h(Button, {
        style: 'margin:20px 0',
        disabled: data.status != null,
        onClick: handleModal
      }, () => ['设置']),
      data.status !== void 0 ? h(Modal, {
        width: 350, closable: !1, maskClosable: !1,
        title: '设置',
        modelValue: data.status != null,
        onOnHidden: handleHidden
      }, {
        footer: () => [
          h(ButtonGroup, null, () => [
            h(Button, {
              disabled: vm.status === 'pending',
              onClick: handleCancel
            }, () => ['取消']),
            h(Button, {
              type: 'primary',
              loading: vm.status === 'pending',
              onClick: handleOk
            }, () => ['确定'])
          ])
        ],
        default: () => [
          h(Row, $rowAttrs, () => [
            h(Col, $colAttrs0, () => ['浏览器：']),
            h(Col, { span: 19 }, () => [
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
            h(Col, $colAttrs0, () => ['分隔符：']),
            h(Col, { span: 19 }, () => [
              h(Input, {
                modelValue: config.separator,
                'onUpdate:modelValue'(_: any) { config.separator = _ }
              })
            ])
          ]),
          h(Row, $rowAttrs, () => [
            h(Col, $colAttrs0, () => ['模板：']),
            h(Col, { span: 19 }, () => [
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