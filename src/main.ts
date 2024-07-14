
import { createApp, createSSRApp } from 'vue'
import App from './components/app.vue'
import { ready } from './plugin'

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
  ; (window as any).vm = vm
