import { type Prop, defineComponent, shallowReactive, watchEffect, createVNode as h, onMounted, onWatcherCleanup } from 'vue'
import { Button, Poptip, SkeletonItem, RadioGroup, Radio } from 'view-ui-plus'
import { $then } from 'bind:utils'
import { canHover } from '@/bind'
const TARGET = import.meta.env.TARGET

let $Scannable: typeof import('@/deps/dep-scannable')
let ready: Promise<void>
const load = () => {
  ready ??= $then(import('@/deps/dep-scannable'), $ => {
    $Scannable = $
  })
}
if (TARGET == 'pages') { load() }

type Type = 'QRCode' | 'DataMatrix' | 'Code128'
const $data = shallowReactive<{
  type: Type
}>({
  type: 'QRCode'
})
const setType = (val: Type) => { $data.type = val }

const ScannableProps: Record<'icon' | 'text', Prop<string>> = { icon: null!, text: null! }
export const Scannable = defineComponent(TARGET == 'server' ? {
  props: ScannableProps,
  render() {
    return h(Poptip, {
      style: 'text-align:start', trigger: 'hover', placement: 'bottom-start', disabled: !this.text
    }, {
      default: () => [h(Button, { icon: this.icon })],
      content: () => null
    })
  }
} : {
  props: ScannableProps,
  setup(props, ctx) {
    const data = shallowReactive<{
      isShow: null | boolean
      trigger: 'hover' | 'click'
      type: Type
      text: null | string
      urlPromise: null | Promise<string | void>
      url: null | string
    }>({
      isShow: null,
      trigger: 'hover',
      type: $data.type,
      text: null,
      urlPromise: null,
      url: null
    })
    watchEffect(() => {
      if (!data.isShow) { return }
      const text = props.text!
      if (data.text === text && data.type === $data.type) { return }
      data.type = $data.type
      data.text = text
      data.url = data.urlPromise = null
      if (!text) { return }
      data.urlPromise = createDataURL(text)
    })
    const createDataURL = async (text: string) => {
      let isAborted = false
      onWatcherCleanup(() => {
        isAborted = true
        if (data.url == null) { data.text = null }
      })
      if (TARGET != 'pages') { load() }
      await new Promise(ok => { setTimeout(ok, 200) })
      await ready
      if (isAborted) { return }
      let url: string
      switch (data.type) {
        case 'QRCode': url = await $Scannable.encodeQRCodeToDataURL(text); break
        case 'DataMatrix': url = $Scannable.encodeDataMatrixToDataURL(text); break
        case 'Code128': url = $Scannable.encodeCode128ToDataURL(text); break
      }
      if (isAborted) { return }
      return data.url = url
    }
    onMounted(() => { data.trigger = canHover ? 'hover' : 'click' })
    const $poptip = {
      style: 'text-align:start', trigger: 'hover', placement: 'bottom-start', disabled: true,
      onOnPopperShow() { data.isShow = true },
      onOnPopperHide() { data.isShow = false }
    }
    return () => h(Poptip, (
      $poptip.disabled = !props.text,
      $poptip.trigger = data.trigger,
      $poptip
    ), {
      default: () => [h(Button, { icon: props.icon })],
      content: () => data.isShow != null ? [
        h(RadioGroup, {
          style: 'display:block;margin:0 0 6px',
          type: 'button', size: 'small',
          modelValue: $data.type,
          ['onUpdate:modelValue']: setType
        }, () => [
          h(Radio, { label: 'QRCode' }),
          h(Radio, { label: 'DataMatrix' }),
          h(Radio, { label: 'Code128' })
        ]),
        data.url != null
          ? h('img', {
            style: 'display:block;zoom:4;min-width:65px;image-rendering:pixelated',
            src: data.url, title: props.text,
          })
          : h(SkeletonItem, {
            style: 'display:block', type: 'rect',
            width: 260, height: 260,
            animated: !!props.text, title: props.text,
          })
      ] : null
    })
  }
})
