
import { registerHooks } from 'node:module'
import deno from '../deno.json' with { type: 'json' }
const { imports } = deno
const { hasOwn } = Object
const { resolve } = import.meta

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (hasOwn(imports, specifier)) {
      return {
        url: resolve(`../${imports[specifier as keyof typeof imports]}`),
        format: 'module', shortCircuit: true
      }
    }
    return nextResolve(specifier, context)
  }
})
