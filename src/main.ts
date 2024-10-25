
import { Temporal } from 'temporal-polyfill'
import { createApp, createSSRApp } from 'vue'
import App from './components/app.vue'
import { ready } from './plugin'
import { assign } from './bind'

let store
if (import.meta.env.TARGET == 'pages') {
  await ready
} else {
  try {
    store = JSON.parse(document.querySelector('#store')?.textContent ?? 'null')
  } catch (error) {
    reportError(error)
  }
}
const app = store == null ? createApp(App) : createSSRApp(App, { store })
const vm = app.mount('#app')
assign(window, { vm, Temporal })
