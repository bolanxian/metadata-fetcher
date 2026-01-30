
/// <reference types="deno" />
/// <reference types="bun" />
/// <reference types="vite/client" />
/// <reference types="bind-script" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
declare module 'view-ui-plus/src/directives/line-clamp' {
  import type { Directive } from 'vue'
  const directive: Directive
  export default directive
}
declare module 'meta:*' {
  const meta: (record: Record<string, string | null | undefined>) => IterableIterator<string>
  export default meta
}
declare module 'bind:WeakMap' {
  import { Binder } from 'bind:core'
  const T: typeof WeakMap & Binder<WeakMap<any, any>>
  export = T
}
declare module 'bind-script/plugin.vite' {
  import { Plugin } from 'vite'
  export const bindScript: () => Plugin
}
declare module 'bind-script/src/utils' {
  export * from 'bind:utils'
}
interface ImportMetaEnv {
  readonly TARGET: 'client' | 'server' | 'pages' | 'koishi'
}
