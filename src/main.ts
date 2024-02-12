
import { createSSRApp } from 'vue'
import App from './components/app.vue'

let store
try {
  store = JSON.parse(document.querySelector('#store')?.textContent ?? 'null')
} catch (error) {

}
store ??= {}
const app = createSSRApp(App, { store })
app.mount('#app')
