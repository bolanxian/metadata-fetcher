
import { renderToWebStream } from 'vue/server-renderer'
import { createSSRApp } from 'vue'
import { resolve, parse, render, renderList, template, readTemplate, writeTemplate, ready } from './plugin'
import App from './components/app.vue'
import type { Store } from './components/app.vue'

export { resolve, parse, render, renderList, readTemplate, writeTemplate, ready }

const _parseToStore = async (store: Store) => {
  store.parsed = await parse(store.input)
  return store
}
export const parseToStore = (input: string) => {
  const resolved = resolve(input)
  if (resolved == null) { return }
  return _parseToStore({ input, resolved, parsed: null, template })
}

export const renderToHtml = (path: string, ssrManifest: {}) => {
  const input = decodeURIComponent(path)
  const store: Store = { input: input, resolved: null, parsed: null, template }
  const app = createSSRApp(App, { store })
  const context = {}
  const stream = renderToWebStream(app, context)

  return { store, stream }
}
