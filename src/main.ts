
import { Temporal } from 'temporal-polyfill'
import { createApp, createSSRApp } from 'vue'
import App from './components/app.vue'
import { ready } from './plugin'
import { assign } from './bind'

const root = document.querySelector('#app')!
let store
if (import.meta.env.TARGET == 'pages') {
  await ready
} else {
  try {
    store = JSON.parse(root.getAttribute('data-store') ?? 'null')
    root.removeAttribute('data-store')
  } catch (error) {
    reportError(error)
  }
}
const app = store == null ? createApp(App) : createSSRApp(App, { store })
const vm = app.mount(root)
assign(window, { vm, Temporal })
