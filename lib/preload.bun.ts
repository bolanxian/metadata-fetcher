
import { plugin } from 'bun'
import { imports } from '../deno.json' with { type: 'json' }

plugin({
  name: 'Import Maps',
  setup(build) {
    for (const [key, value] of Object.entries(imports)) {
      build.module(key, async () => {
        return { exports: await import(`../${value}`), loader: 'object' }
      })
    }
  }
})
