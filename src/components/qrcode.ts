import { type Prop, defineComponent, shallowReactive, watchEffect, createVNode as h, onMounted, onWatcherCleanup } from 'vue'
import { Button, Poptip, SkeletonItem } from 'view-ui-plus'
import { $then } from 'bind:utils'
import { canHover } from '@/bind'
const TARGET = import.meta.env.TARGET

let toDataURL: typeof import('qrcode').toDataURL
let ready: Promise<void>
const load = () => {
  ready ??= $then(import('@/deps/dep-qrcode'), $ => {
    ({ toDataURL } = $)
  })
}
if (TARGET == 'pages') { load() }

const QRCodeProps: Record<'icon' | 'text', Prop<string>> = { icon: null!, text: null! }
export const QRCode = defineComponent(TARGET == 'server' ? {
  props: QRCodeProps,
  render() {
    return h(Poptip, {
      trigger: 'hover', placement: 'bottom-start', disabled: !this.text
    }, {
      default: () => [h(Button, { icon: this.icon })],
      content: () => [h(SkeletonItem, {
        style: 'margin:5px 0', animated: !!this.text,
        width: 240, height: 240, type: 'rect'
      })]
    })
  }
} : {
  props: QRCodeProps,
  setup(props, ctx) {
    const data = shallowReactive<{
      isShow: boolean
      trigger: 'hover' | 'click'
      text: null | string
      urlPromise: null | Promise<string | void>
      url: null | string
    }>({
      isShow: false,
      trigger: 'hover',
      text: null,
      urlPromise: null,
      url: null
    })
    watchEffect(() => {
      if (!data.isShow) { return }
      const text = props.text!
      if (data.text === text) { return }
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
      const url = await toDataURL(text, {
        type: 'image/png',
        margin: 0, scale: 1,
      })
      if (isAborted) { return }
      return data.url = url
    }
    onMounted(() => { data.trigger = canHover ? 'hover' : 'click' })
    const $poptip = {
      trigger: 'hover', placement: 'bottom-start', disabled: true,
      onOnPopperShow() { data.isShow = true },
      onOnPopperHide() { data.isShow = false }
    }
    return () => h(Poptip, (
      $poptip.disabled = !props.text,
      $poptip.trigger = data.trigger,
      $poptip
    ), {
      default: () => [h(Button, { icon: props.icon })],
      content: () => [
        data.url != null
          ? h('img', {
            style: 'margin:5px 0;image-rendering:pixelated;object-fit:contain',
            width: 240, height: 240,
            src: data.url, title: props.text,
          })
          : h(SkeletonItem, {
            style: 'margin:5px 0', type: 'rect',
            width: 240, height: 240,
            animated: !!props.text, title: props.text,
          })
      ]
    })
  }
})
