
import { createApp, createSSRApp } from 'vue'
import App from './components/app.vue'

let store
try {
  store = JSON.parse(document.querySelector('#store')?.textContent ?? 'null')
} catch (error) {

}
const app = store == null ? createApp(App) : createSSRApp(App, { store })
const vm = app.mount('#app')
  ; (window as any).vm = vm
