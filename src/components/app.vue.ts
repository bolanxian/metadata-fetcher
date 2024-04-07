
import { defineComponent, shallowRef as sr, shallowReactive, watch, createVNode as h, onMounted, onServerPrefetch } from 'vue'
import type { Prop } from 'vue'
import { Row, Col, Input, Button, Modal, Message } from 'view-ui-plus'
import {
  resolve, parse, xparse, render as _render,
  renderIds, renderList, renderListNameRender,
  template as _template, defaultTemplate, writeTemplate, $fetch
} from '../plugin'
import type { ResolvedInfo, ParsedInfo } from '../plugin'
import { nextTick, $string, split } from '../bind'
import.meta.glob('../plugins/*', { eager: true })
const { trim, slice, indexOf } = $string
const SSR = import.meta.env.SSR
const PAGES = import.meta.env.PAGES
const S = /\s+/

export interface Store {
  input: string
  resolved: ResolvedInfo | null
  parsed: ParsedInfo | null
  output: string
  template: string
}

const renderName = (args: string[], _template?: string) => renderList(args, _template, renderListNameRender)
const getRender = (id: string): {
  (args: string[], _template?: string): Generator<string, void, unknown> | AsyncGenerator<string, void, unknown>
} => {
  switch (id) {
    case '.id': return renderIds
    case '.list': return renderList
    case '.name': return renderName
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

    const store = PAGES ? null : props.store
    const data = SSR ? store! : shallowReactive(store ?? {
      input: '',
      resolved: null,
      parsed: null,
      output: '',
      template: _template
    })
    expose({ data })

    SSR && data.input && onServerPrefetch(async () => {
      if (data.resolved != null) {
        data.output = ''
        const { id, url } = data.resolved
        for await (const line of getRender(id)(split(S, url), data.template)) {
          data.output += `${line}\n`
        }
        return
      }
      const [resolved, parsedPromise] = xparse(data.input)
      if (resolved == null) { return }
      data.resolved = resolved
      data.parsed = await parsedPromise!
      data.output = _render(data.parsed, data.template)
    })
    !SSR && watch(() => data.input, input => {
      try {
        input = trim(input)
        let id: string | null = null
        switch (slice(input, 0, indexOf(input, ' '))) {
          case 'id': case '!': id = '.id'; break
          case 'list': case '!!': id = '.list'; break
          case 'name': case '=': id = '.name'; break
        }
        if (id != null) {
          const [, ...args] = split(S, input)
          let ret = ''
          for (const arg of args) {
            ret += `${resolve(arg)?.id ?? '!'} `
          }
          data.resolved = { id, rawId: id, shortUrl: '', url: trim(ret) }
        } else {
          data.resolved = resolve(input)
        }
      } catch (error) {
        data.resolved = null
      }
    })

    const handleSearch = PAGES ? async () => {
      if ($disabled.value || data.resolved == null) { return }
      try {
        $loading.value = true
        data.output = ''
        const { id, url } = data.resolved
        if (id[0] === '.') {
          for await (const line of getRender(id)(split(S, url), data.template)) {
            data.output += `${line}\n`
          }
        } else {
          data.parsed = await parse(data.input)!
          data.output = _render(data.parsed, data.template)
        }
      } catch (error) {
        data.parsed = null
        data.output = ''
        throw error
      } finally {
        $loading.value = false
      }
    } : () => {
      if ($disabled.value || data.resolved == null) { return }
      const { id, url } = data.resolved
      if (id[0] === '.') {
        const params = new URLSearchParams()
        for (const arg of split(S, url)) {
          params.append('id', arg)
        }
        location.href = `./${encodeURIComponent(id)}?${params}`
      } else {
        location.href = `./${encodeURIComponent(id)}`
      }
    }

    const handleFocus = (e: FocusEvent) => {
      (e.target as HTMLInputElement).select()
    }
    const handleTemplate = () => {
      modalTemplate(data.template, _ => {
        data.template = _
        data.output = data.parsed != null ? _render(data.parsed, data.template) : ''
      })
    }
    return () => [
      h('div', { style: 'margin:60px auto 40px auto;text-align:center' }, [
        h('h2', null, ['\u3000'])
      ]),
      h(Row, {}, () => [
        h(Col, { xs: 0, sm: 2, md: 4, lg: 6 }),
        h(Col, { xs: 24, sm: 20, md: 16, lg: 12 }, () => [
          h(Input, {
            modelValue: data.input,
            'onUpdate:modelValue'(value: string) { data.input = value },
            onOnEnter: handleSearch
          }, {
            append: () => h(Button, {
              icon: 'ios-search',
              loading: $loading.value,
              disabled: $disabled.value || data.resolved == null,
              onClick: handleSearch
            })
          }),
          h(Input, {
            modelValue: data.resolved?.url ?? '',
            onOnFocus: handleFocus,
            readonly: true
          }, {
            prepend: () => h('span', null, ['解析为：']),
          }),
          h(Input, {
            style: data.resolved?.shortUrl ? null : 'display:none',
            modelValue: data.resolved?.shortUrl ?? '',
            onOnFocus: handleFocus,
            readonly: true
          }, {
            prepend: () => h('span', null, ['短链接：']),
          }),
          !PAGES || $fetch != null ? h(Input, {
            ref: $outputVm,
            style: 'margin-top:20px',
            type: 'textarea',
            autosize: { minRows: 20, maxRows: 1 / 0 },
            modelValue: data.output,
            readonly: true
          }) : null,
          !PAGES || $fetch != null ? h(Button, {
            style: 'margin-top:20px',
            disabled: $disabled.value,
            onClick: handleTemplate
          }, () => '编辑模板') : null
        ])
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
        if (PAGES) {
          await writeTemplate(template)
          ok = true
        } else {
          const body = template
          const resp = await fetch('./.template', {
            method: 'POST',
            body,
            headers: {
              'content-type': 'text/plain'
            }
          })
          ok = resp.ok
        }
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