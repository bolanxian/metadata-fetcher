
import { renderToWebStream } from 'vue/server-renderer'
import { createSSRApp } from 'vue'
import { $string, $array } from './bind'
import { template } from './plugin'
import App from './components/app.vue'
import type { Store } from './components/app.vue'
const { slice } = $string
const { join } = $array

export { bindCall, $string, $array } from './bind'
export {
  resolve, parse, xparse,
  render, renderIds, renderList,
  renderListDefaultRender, renderListNameRender,
  getSeparator, readTemplate, writeTemplate, ready
} from './plugin'

export const renderToHtml = (input: string, ids?: string[]) => {
  const store: Store = { input: input, resolved: null, parsed: null, output: '', template }
  if (input[0] === '.') {
    const args = join(ids!, ' ')
    store.input = `${slice(input, 1)} ${args}`
    store.resolved = { id: input, rawId: input, shortUrl: '', url: args }
  }
  const app = createSSRApp(App, { store })
  const context = {}
  const stream = renderToWebStream(app, context)

  return { store, stream }
}
