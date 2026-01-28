
//@ts-ignore
import { type ResolveHook, registerHooks } from 'node:module'
import deno from '../deno.json' with { type: 'json' }
const { imports } = deno

const resolve: ResolveHook = (specifier, context, nextResolve) => {
  if (Object.hasOwn(imports, specifier)) {
    return {
      url: import.meta.resolve(`../${imports[specifier as keyof typeof imports]}`),
      format: 'module', shortCircuit: true
    }
  }
  return nextResolve(specifier, context)
}

registerHooks({ resolve })