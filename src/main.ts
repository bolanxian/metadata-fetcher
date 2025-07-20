
import '@/meta-fetch/mod'
import { Temporal } from 'temporal-polyfill'
import { createApp, createSSRApp } from 'vue'
import { on } from 'bind:utils'
import { assign } from 'bind:Object'
import { ready } from './init'
import App from './components/app.vue'
const PAGES = import.meta.env.TARGET == 'pages'

const root = document.querySelector('#app')!
let store
if (PAGES) {
  await ready
} else {
  try {
    store = JSON.parse(root.getAttribute('data-store') ?? 'null')
    root.removeAttribute('data-store')
  } catch (error) {
    reportError(error)
  }
}
await new Promise<FocusEvent | void>(ok => {
  if (document.hasFocus()) { return ok() }
  on(document, 'focus', ok, { once: !0, capture: !0 })
})
const app = (!PAGES && root.children.length > 0 ? createSSRApp : createApp)(App, { store })
const vm = app.mount(root)
assign(window, { vm, Temporal })
