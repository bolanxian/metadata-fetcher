
import { defineComponent, shallowRef as sr, watch, createVNode as h, onMounted, onServerPrefetch } from 'vue'
import type { Prop } from 'vue'
import { Row, Col, Input, Button, Modal, Message } from 'view-ui-plus'
import { resolve, parse, render as _render, renderList, template as _template, defaultTemplate, writeTemplate, $fetch } from '../plugin'
import type { ResolvedInfo, ParsedInfo } from '../plugin'
import { nextTick, $string, test, split } from '../bind'
import.meta.glob('../plugins/*', { eager: true })
const { trim } = $string
const SSR = import.meta.env.SSR
const PAGES = import.meta.env.PAGES

export interface Store {
  input: string
  resolved: ResolvedInfo | null
  parsed: ParsedInfo | null
  template: string | null
}

export default defineComponent({
  props: { store: null! as Prop<Store> },
  setup(props) {
    const $loading = sr(false)
    const $disabled = sr(true)
    const $outputVm = sr<InstanceType<typeof Input> | null>(null)
    !PAGES || $fetch != null ? onMounted(() => {
      $disabled.value = false
      //@ts-ignore
      nextTick($outputVm.value.resizeTextarea)
    }) : null

    const store = PAGES ? null : props.store
    let template = store?.template ?? _template
    const $input = sr(store?.input ?? '')
    const $resolved = sr(store?.resolved)
    const $parsed = sr(store?.parsed)
    const $output = sr('')
    const render = () => {
      $output.value = $parsed.value != null ? _render($parsed.value, template) : ''
    }
    SSR && store!.input && onServerPrefetch(async () => {
      const resolved = resolve(store!.input)
      if (resolved == null) { return }
      $resolved.value = resolved
      store!.resolved = resolved
      const parsed = await parse(store!.input)
      $parsed.value = parsed
      store!.parsed = parsed
      render()
    })
    !SSR && watch($input, input => {
      try {
        input = trim(input)
        if (PAGES && test(/^(?:!|list)\s+/, input)) {
          const id = 'list', [, ...args] = split(/\s+/, input)
          let ret = ''
          for (const arg of args) {
            ret += `${resolve(arg)?.rawId ?? '!'} `
          }
          $resolved.value = { id, rawId: id, shortUrl: '', url: ret }
        } else {
          $resolved.value = resolve(input)
        }
      } catch (error) {
        $resolved.value = null
      }
    })
    SSR || PAGES ? null : render()
    const handleSearch = PAGES ? async () => {
      try {
        $loading.value = true
        $output.value = ''
        if (PAGES && $resolved.value!.id === 'list') {
          const [, ...args] = split(/\s+/, $input.value)
          for await (const line of renderList(args, template)) {
            $output.value += `${line}\n`
          }
        } else {
          $parsed.value = await parse($input.value)
          render()
        }
      } catch (error) {
        $parsed.value = null
        $output.value = ''
      } finally {
        $loading.value = false
      }
    } : () => {
      location.href = `./${encodeURIComponent($resolved.value!.id)}`
    }

    const handleFocus = (e: FocusEvent) => {
      (e.target as HTMLInputElement).select()
    }
    const handleTemplate = () => {
      modalTemplate(template, _ => {
        template = _
        render()
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
            modelValue: $input.value,
            'onUpdate:modelValue'(value: string) { $input.value = value }
          }, {
            append: () => h(Button, {
              icon: 'ios-search',
              loading: $loading.value,
              disabled: $disabled.value || $resolved.value == null,
              onClick: handleSearch
            })
          }),
          h(Input, {
            modelValue: $resolved.value?.url ?? '',
            onOnFocus: handleFocus,
            readonly: true
          }, {
            prepend: () => h('span', null, ['解析为：']),
          }),
          h(Input, {
            style: $resolved.value?.shortUrl ? null : 'display:none',
            modelValue: $resolved.value?.shortUrl ?? '',
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
            modelValue: $output.value,
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