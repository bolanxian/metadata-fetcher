
import '@/meta-fetch/mod'
import { createApp, createSSRApp } from 'vue'
import { on, off } from 'bind:utils'
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
  const options = { once: !0, capture: !0 }
  const done = (e?: FocusEvent) => {
    ok(e)
    clearTimeout(timer)
    off(document, 'focus', done, options)
  }
  const timer = setTimeout(done, 200)
  on(document, 'focus', done, options)
})
const app = (!PAGES && root.children.length > 0 ? createSSRApp : createApp)(App, { store })
const vm = app.mount(root)
{ (window as any).vm = vm }
