
import { defineComponent, shallowRef as sr, createVNode as h, onMounted } from 'vue'
import { Row, Col, Input, Button } from 'view-ui-plus'

export default defineComponent({
  props: { store: null },
  setup(props) {
    const disabled = sr(true)
    onMounted(() => { disabled.value = false })

    const input = sr<string>(props.store.input ?? '')
    const output = sr<string>(props.store.output ?? '')
    const handleSearch = () => {
      history.pushState(null, '', `./${encodeURIComponent(input.value)}`)
      output.value = input.value
    }
    return () => [
      h('div', { style: 'margin:60px auto 40px auto;text-align:center' }, [
        h('h2', null, ['\u3000'])
      ]),
      h(Row, {}, () => [
        h(Col, { xs: 0, sm: 2, md: 4, lg: 6 }),
        h(Col, { xs: 24, sm: 20, md: 16, lg: 12 }, () => [
          h(Input, {
            disabled: disabled.value,
            modelValue: input.value,
            'onUpdate:modelValue'(value: string) { input.value = value }
          }, {
            append: () => h(Button, {
              icon: 'ios-search',
              onClick: handleSearch
            })
          }),
          h(Input, {
            style: 'margin-top:20px',
            disabled: disabled.value,
            modelValue: output.value,
            readonly: true
          })
        ])
      ])
    ]
  }
})
