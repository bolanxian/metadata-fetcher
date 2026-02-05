
import { defineComponent, shallowReactive, watchEffect, createVNode as h } from 'vue'
import type { Prop } from 'vue'
import { Row, Col, Input, Checkbox, ButtonGroup, Button, Select, Option, Modal } from 'view-ui-plus'
import { entries } from 'bind:Object'
import { from } from 'bind:Array'
import { nextTick } from '@/bind'
import type { Config } from '@/config'

export default defineComponent({
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
    const $colAttrs2 = { offset: 6, span: 18 }
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
            h(Col, $colAttrs2, () => [
              h(Checkbox, {
                border: true,
                disabled: import.meta.env.TARGET == 'pages',
                modelValue: config.ssr,
                'onUpdate:modelValue'(_: any) { config.ssr = _ }
              }, () => ['服务端渲染'])
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
