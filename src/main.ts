
import { Temporal } from 'temporal-polyfill'
import { createApp, createSSRApp } from 'vue'
import App from './components/app.vue'
import { ready } from './plugin'
import { assign } from './bind'
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
const app = (!PAGES && root.children.length > 0 ? createSSRApp : createApp)(App, { store })
const vm = app.mount(root)
assign(window, { vm, Temporal })
