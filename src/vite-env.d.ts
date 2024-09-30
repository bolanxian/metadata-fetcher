/// <reference types="vite/client" />

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
interface ImportMetaEnv {
  readonly TARGET: 'client' | 'server' | 'pages' | 'koishi'
}
