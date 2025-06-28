import { defineComponent, shallowReactive, watchEffect, createVNode as h, onMounted } from 'vue'
import type { Prop } from 'vue'
import { Row, Col, Modal, Button, Input, Checkbox, Select, Option } from 'view-ui-plus'
import { nextTick } from '../bind'
import { entries } from 'bind:Object'
import { from } from 'bind:Array'
import { config } from '../config'
const TARGET = import.meta.env.TARGET

const DialogProps: Record<'type' | 'path', Prop<string>> = { type: null!, path: null! }
export const Dialog = defineComponent(TARGET != 'client' ? {
  props: DialogProps,
  render: () => [null]
} : {
  props: DialogProps,
  setup(props, ctx) {
    const data = shallowReactive<{
      status: undefined | null | 'ready'
      title: string
      batchType: string
      illustMode: boolean
      outputBatch: boolean
      href: string | null
    }>({
      status: void 0,
      title: '',
      batchType: '.id',
      illustMode: false,
      outputBatch: false,
      href: null
    })
    onMounted(() => {
      data.status = null
      nextTick(() => { data.status = 'ready' })
    })
    watchEffect(() => {
      let displayType = ''
      switch (props.type) {
        case 'file': displayType = '文件'; break
        case 'directory': displayType = '目录'; break
      }
      data.title = `打开${displayType}`
    })
    watchEffect(() => {
      let { type } = props
      switch (type) {
        case 'file': case 'directory': break
        default: type = 'file'
      }
      const init: Record<string, string> = {
        __proto__: null!,
        mode: data.illustMode ? 'illust' : null!,
        batch: data.outputBatch ? null! : data.batchType,
        output: data.outputBatch ? 'batch' : null!,
        path: props.path!
      }
      for (const key in init) {
        if (init[key] == null) { delete init[key] }
      }
      data.href = `./.${type}?${new URLSearchParams(init)}`
    })

    const $rowAttrs = { style: 'margin-bottom:24px' }
    const $colAttrs0 = { span: 5, style: 'text-align:right;padding-right:8px;line-height:32px;' }
    return () => [
      data.status !== void 0 ? h(Modal, {
        width: 512, closable: !1, maskClosable: !1, transfer: true,
        title: data.title,
        modelValue: data.status != null
      }, {
        footer: () => [
          h(Button, {
            type: 'primary',
            style: 'width:100%',
            to: data.href
          }, () => ['确定'])
        ],
        default: () => [
          h(Input, {
            ...$rowAttrs,
            title: props.path,
            modelValue: props.path,
            readonly: true
          }),
          h(Row, $rowAttrs, () => [
            h(Col, $colAttrs0, () => ['批量模式：']),
            h(Col, { span: 19 }, () => [
              h(Select, {
                transfer: true,
                disabled: data.outputBatch,
                modelValue: data.batchType,
                'onUpdate:modelValue'(_: any) { data.batchType = _ }
              }, () => from(entries(config.batch), ([key, { name }]) => h(Option, {
                value: key, style: name ? null : 'display:none'
              }, () => [name])))
            ])
          ]),
          h(Row, $rowAttrs, () => [
            h(Col, { span: 19, offset: $colAttrs0.span }, () => [
              h(Checkbox, {
                modelValue: data.illustMode,
                'onUpdate:modelValue'(_: any) { data.illustMode = _ }
              }, () => ['插画模式']),
              h(Checkbox, {
                modelValue: data.outputBatch,
                'onUpdate:modelValue'(_: any) { data.outputBatch = _ }
              }, () => ['输出为批处理']),
            ])
          ])
        ]
      }) : null
    ]
  }
})
