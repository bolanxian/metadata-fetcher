
import { plugin } from 'bun'
import { imports } from '../deno.json' with { type: 'json' }
const { stringify } = JSON

plugin({
  name: 'Import Maps',
  setup(build) {
    for (const [key, value] of Object.entries(imports)) {
      build.module(key, () => {
        const id = import.meta.resolve(`../${value}`)
        return { contents: `export * from ${stringify(id)}`, loader: 'js' }
      })
    }
  }
})
