
import { renderToWebStream } from 'vue/server-renderer'
import { createSSRApp } from 'vue'
import App from './components/app.vue'

export function render(path: string, ssrManifest: {}) {
  const input = decodeURIComponent(path)
  const store = { input: input, output: input }
  const app = createSSRApp(App, { store })
  const context = {}
  const stream = renderToWebStream(app, context)

  return { store, stream }
}
