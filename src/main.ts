
import '@/meta-fetch/mod'
import { type ComponentPublicInstance, createApp, createSSRApp } from 'vue'
import { Message } from 'view-ui-plus'
import { defineProperty, assign } from 'bind:Object'
import { config } from './config'
import { ready } from './init'
import App, { type Store } from './components/app.vue'
const TARGET = import.meta.env.TARGET
const CSR = TARGET == 'client'
const tagName = 'metadata-fetcher'
declare global {
  interface HTMLElementTagNameMap {
    [tagName]: MetadataFetcher
  }
}

await ready
export class MetadataFetcher extends HTMLElement {
  static {
    customElements.define(tagName, this)
    defineProperty(window, 'vm', {
      get() {
        const el = document.getElementsByTagName(tagName)[0]
        return el != null ? el.#vm : null
      }
    })
  }
  #vm: ComponentPublicInstance = null!
  get _vm() { return this.#vm }
  constructor() {
    super()
    let store: Store | undefined
    if (CSR) {
      try {
        store = JSON.parse(this.getAttribute('data-store')!)
        this.removeAttribute('data-store')
        assign(config, store!.config)
      } catch (error) {
        reportError(error)
      }
    }
    const create = CSR && this.children.length > 0 ? createSSRApp : createApp
    const app = create(App, { store })
    app.config.errorHandler = (err, instance, info) => {
      Message['error']('发生错误')
      reportError(err)
    }
    this.#vm = app.mount(this)
  }
}
