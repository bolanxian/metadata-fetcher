
import { defineComponent, shallowRef as sr, shallowReactive, watch, createVNode as h, onMounted, onServerPrefetch } from 'vue'
import type { Component, Prop } from 'vue'
import { Row, Col, Icon, Input, Button, Modal, Message } from 'view-ui-plus'
import {
  resolve, xparse, render as _render,
  renderIds, renderList, renderListNameRender, renderListEscapeRender,
  template as _template, defaultTemplate, writeTemplate, $fetch
} from '../plugin'
import type { ResolvedInfo, ParsedInfo } from '../plugin'
import { nextTick, $string, split } from '../bind'
import.meta.glob('../plugins/*', { eager: true })
const { trim, slice, indexOf, startsWith } = $string
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
  template: string
}

const renderName = (args: string[], _template?: string) => renderList(args, _template, renderListNameRender)
const renderEscape = (args: string[], _template?: string) => renderList(args, _template, renderListEscapeRender)
const getRender = (id: string): {
  (args: string[], _template?: string): Generator<string, void, unknown> | AsyncGenerator<string, void, unknown>
} => {
  switch (id) {
    case '.id': return renderIds
    case '.list': return renderList
    case '.name': return renderName
    case '.escape': return renderEscape
  }
  return null!
}

export default defineComponent({
  props: PAGES ? (void 0)! : { store: null! as Prop<Store> },
  setup(props, { expose }) {
    const $loading = sr(false)
    const $disabled = sr(true)
    const $outputVm = sr<InstanceType<typeof Input> | null>(null)
    !PAGES || $fetch != null ? onMounted(() => {
      $disabled.value = false
      //@ts-ignore
      nextTick($outputVm.value.resizeTextarea)
    }) : null

    let component: Component | undefined
    const $store = PAGES ? null : props.store
    const store = SSR ? $store! : shallowReactive($store ?? {
      input: '',
      resolved: null,
      data: null,
      parsed: null,
      output: '',
      template: _template
    })

    SSR && store.input && onServerPrefetch(async () => {
      if (store.resolved != null) {
        store.output = ''
        const { id, url } = store.resolved
        for await (const line of getRender(id)(split(S, url), store.template)) {
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
        store.output = _render(store.parsed, store.template)
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
          case 'id': case '!': id = '.id'; break
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
      if ($disabled.value || store.resolved == null) { return }
      try {
        $loading.value = true
        store.output = ''
        const { id, url } = store.resolved
        if (id[0] === '.') {
          for await (const line of getRender(id)(split(S, url), store.template)) {
            store.output += `${line}\n`
          }
        } else {
          if (startsWith(id, '@redirect!')) { return }
          const [plugin, resolved, , dataPromise, parsedPromise] = xparse(store.input)
          component = plugin!.component
          store.resolved = resolved!
          store.data = await dataPromise!
          if ((store.parsed = await parsedPromise!) != null) {
            store.output = _render(store.parsed, store.template)
          }
        }
      } catch (error) {
        component = void 0
        store.data = null
        store.parsed = null
        store.output = ''
        throw error
      } finally {
        $loading.value = false
      }
    } : () => {
      if ($disabled.value || store.resolved == null) { return }
      const { id, url } = store.resolved
      if (id[0] === '.') {
        const params = new URLSearchParams()
        for (const arg of split(S, url)) {
          params.append('id', arg)
        }
        location.href = `./${encodeURIComponent(id)}?${params}`
      } else if (startsWith(id, '@redirect!')) {
        location.href = `./.redirect?url=${encodeURIComponent(url)}`
      } else {
        location.href = `./${encodeURIComponent(id)}`
      }
    }

    const handleFocus = (e: FocusEvent) => {
      (e.target as HTMLInputElement).select()
    }
    const handleTemplate = () => {
      modalTemplate(store.template, _ => {
        store.template = _
        store.output = store.parsed != null ? _render(store.parsed, store.template) : ''
      })
    }
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
              loading: $loading.value,
              disabled: $disabled.value || store.resolved == null,
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
          !PAGES || $fetch != null ? h(Input, {
            ref: $outputVm,
            style: 'margin-top:20px',
            type: 'textarea',
            autosize: { minRows: 20, maxRows: 1 / 0 },
            modelValue: store.output,
            readonly: true
          }) : null,
          !PAGES || $fetch != null ? h(Button, {
            style: 'margin:20px 0',
            disabled: $disabled.value,
            onClick: handleTemplate
          }, () => '编辑模板') : null
        ]),
        component != null ? h(Col, { xs: 24, sm: 12, md: 11, lg: 10 }, () => [
          h(component!, { data: store.data })
        ]) : null
      ])
    ]
  }
})

const modalTemplate = (template: string, onOk: (template: string) => void) => {
  Modal.confirm({
    title: '编辑模板',
    width: 600,
    loading: true,
    closable: true,
    render() {
      return h(Input, {
        type: 'textarea',
        autosize: { minRows: 20, maxRows: 1 / 0 },
        modelValue: template,
        'onUpdate:modelValue'(value: string) { template = value }
      })
    },
    async onOk() {
      let ok = false
      try {
        template = trim(template) ? template : defaultTemplate
        ok = await writeTemplate(template)
      } finally {
        if (ok) {
          if (!PAGES) { location.href += ''; return }
          onOk(template)
        } else {
          Message.error('失败')
        }
        Modal.remove()
      }
    }
  })
}