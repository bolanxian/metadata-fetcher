
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
declare module 'bind:WeakMap' {
  const T: typeof WeakMap & import('bind:core').Binder<WeakMap<any, any>>
  export = T
}
declare module 'meta:*' {
  const meta: (record: Record<string, string | null | undefined>) => IterableIterator<string>
  export default meta
}
interface ImportMetaEnv {
  readonly TARGET: 'client' | 'server' | 'pages' | 'koishi'
}
