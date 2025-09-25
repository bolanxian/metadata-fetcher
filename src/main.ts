
import '@/meta-fetch/mod'
import { type ComponentPublicInstance, createApp, createSSRApp } from 'vue'
import { $then } from 'bind:utils'
import { defineProperty } from 'bind:Object'
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
        store = JSON.parse(this.getAttribute('data-store') ?? 'null')
        this.removeAttribute('data-store')
      } catch (error) {
        reportError(error)
      }
    }
    const create = CSR && this.children.length > 0 ? createSSRApp : createApp
    $then(ready, _ => {
      const app = create(App, { store })
      this.#vm = app.mount(this)
    })
  }
}
