
import '@/meta-fetch/mod'
import { createApp, createSSRApp } from 'vue'
import { on, off } from 'bind:utils'
import { ready } from './init'
import App from './components/app.vue'
const TARGET = import.meta.env.TARGET
const CSR = TARGET == 'client'
const PAGES = TARGET == 'pages'

const root = document.querySelector('#app')!
let store
if (CSR) {
  try {
    store = JSON.parse(root.getAttribute('data-store') ?? 'null')
    root.removeAttribute('data-store')
  } catch (error) {
    reportError(error)
  }
}
if (document.visibilityState !== 'visible') {
  await new Promise<Event | void>(ok => {
    const type = 'visibilitychange'
    const done = (e: Event) => {
      if (document.visibilityState !== 'visible') { return }
      ok(e)
      off(document, type, done)
    }
    on(document, type, done)
  })
}
if (PAGES) {
  await ready
}
const app = (!PAGES && root.children.length > 0 ? createSSRApp : createApp)(App, { store })
const vm = app.mount(root)
{ (window as any).vm = vm }
