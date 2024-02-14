
import { defineComponent, shallowRef as sr, watch, createVNode as h, onMounted, onServerPrefetch } from 'vue'
import type { Prop } from 'vue'
import { Row, Col, Input, Button } from 'view-ui-plus'
import { resolve, parse, render } from '../plugin'
import type { ResolvedInfo, ParsedInfo } from '../plugin'
import { nextTick } from '../bind'
import '../plugins/bili'
import '../plugins/nico'
import '../plugins/tube'

export interface Store {
  input: string
  resolved: ResolvedInfo | null
  parsed: ParsedInfo | null
}

export default defineComponent({
  props: { store: null! as Prop<Store> },
  setup(props) {
    const $disabled = sr(true)
    const $parsedVm = sr<InstanceType<typeof Input> | null>(null)
    onMounted(() => {
      $disabled.value = false
      //@ts-ignore
      nextTick($parsedVm.value.resizeTextarea)
    })

    const store = props.store
    const $input = sr(store?.input ?? '')
    const $resolved = sr(store?.resolved)
    const $parsed = sr(store?.parsed)
    store!.input && onServerPrefetch(async () => {
      const resolved = resolve(store!.input)
      if (resolved == null) { return }
      $resolved.value = resolved
      store!.resolved = resolved
      const parsed = await parse(store!.input)
      $parsed.value = parsed
      store!.parsed = parsed
    })
    watch($input, input => {
      try {
        $resolved.value = resolve(input)
      } catch (error) {
        $resolved.value = null
      }
    })
    const handleSearch = () => {
      location.href = `./${encodeURIComponent($resolved.value!.id)}`
    }
    return () => [
      h('div', { style: 'margin:60px auto 40px auto;text-align:center' }, [
        h('h2', null, ['\u3000'])
      ]),
      h(Row, {}, () => [
        h(Col, { xs: 0, sm: 2, md: 4, lg: 6 }),
        h(Col, { xs: 24, sm: 20, md: 16, lg: 12 }, () => [
          h(Input, {
            disabled: $disabled.value,
            modelValue: $input.value,
            'onUpdate:modelValue'(value: string) { $input.value = value }
          }),
          h(Input, {
            style: 'margin-top:20px',
            modelValue: $resolved.value?.url ?? '',
            readonly: true
          }, {
            prepend: () => h('span', null, ['解析为：']),
            append: () => h(Button, {
              icon: 'ios-search',
              disabled: $disabled.value || $resolved.value == null,
              onClick: handleSearch
            })
          }),
          h(Input, {
            ref: $parsedVm,
            style: 'margin-top:20px',
            type: 'textarea',
            autosize: { minRows: 20, maxRows: 1 / 0 },
            modelValue: $parsed.value != null ? render($parsed.value) : '',
            readonly: true
          })
        ])
      ])
    ]
  }
})
