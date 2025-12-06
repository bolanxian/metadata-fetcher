
import process from 'node:process'
import { type Plugin, defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { bindScript } from 'bind-script/plugin.vite'
import { resolve } from 'node:path/posix'

const destroyModulePreload = (): Plugin => {
  const name = 'Destroy `vite:build-import-analysis`'
  const { exec } = RegExp.prototype, { apply } = Reflect
  // from vite@6.2.5/dist/node/chunks/dep-Pj_jxEzN.js:50550
  const target = /((?:\bconst\s+|\blet\s+|\bvar\s+|,\s*)(\{[^{}.=]+\})\s*=\s*await\s+import\([^)]+\))|(\(\s*await\s+import\([^)]+\)\s*\)(\??\.[\w$]+))|\bimport\([^)]+\)(\s*\.then\(\s*(?:function\s*)?\(\s*\{([^{}.=]+)\}\))/g
  RegExp.prototype.exec = function (this: RegExp, string: string) {
    if (this.source === target.source && this.flags === target.flags) {
      this.exec = (string: string) => null
      RegExp.prototype.exec = exec
      return this.exec(string)
    }
    return apply(exec, this, [string])
  }
  return {
    name,
    apply: 'build',
    transform: {
      order: 'post',
      handler(code, id) {
        if (id.startsWith('\0vite/preload-helper')) {
          return `export let __vitePreload`
        }
        if (id.startsWith('\0vite/modulepreload-polyfill')) { return '' }
        if (code.includes('__vitePreload(')) {
          return code.replace(/__vitePreload\(\(\) => ([^,]+?),__VITE_IS_MODERN__\?"?__VITE_PRELOAD__"?\:void 0,import\.meta\.url\)/, '$1')
        }
      }
    }
  }
}

const externalAssets = (): Plugin => {
  const reg = /\/(ionicons)-[-\w]{8}\.((?!woff2)\S+)$/
  return {
    name: 'external-assets',
    apply: 'build',
    config(config, env) {
      return {
        experimental: {
          renderBuiltUrl(fileName, { type, hostId, hostType }) {
            if (type === 'asset' && hostType === 'css') {
              const m = fileName.match(reg)
              if (m != null) { return 'about:invalid' }
            }
            return { relative: true }
          }
        }
      }
    },
    generateBundle(options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        const m = fileName.match(reg)
        if (m != null) { delete bundle[fileName] }
      }
    }
  }
}

const buildTarget = (): Plugin => {
  const map = new Map()
  for (const name of ['countup.js', 'numeral', 'dayjs', 'js-calendar', 'view-ui-plus/src/utils/date']) {
    map.set(name, 'export default null')
  }
  map.set('undici', 'export let stream')
  map.set('encoding-sniffer', 'export let decodeBuffer, DecodeStream')
  map.set('qrcode', 'export let toDataURL')
  map.set('cheerio', 'export let load')
  map.set('@xterm/xterm', 'export let Terminal')
  map.set('@xterm/addon-webgl', 'export let WebglAddon')

  let target: 'client' | 'server' | 'pages' | 'koishi'
  return {
    name: 'target',
    enforce: 'pre',
    apply: 'build',
    config(config, { isSsrBuild }) {
      target = !isSsrBuild ? (process.env.VITE_TARGET as typeof target) ?? 'client' : 'server'
      let external: typeof config.build.rollupOptions.external
      if (target == 'server') {
        map.delete('cheerio')
      } else if (target == 'client') {
        map.delete('qrcode')
        map.delete('@xterm/xterm')
        map.delete('@xterm/addon-webgl')
      } else if (target == 'pages') {
        map.delete('qrcode')
        config.build.outDir = '../dist-pages'
        config.build.assetsDir = 'assets'
      } else if (target == 'koishi') {
        config.build.outDir = '../koishi-plugin'
        config.build.lib = {
          entry: 'main.koishi.ts',
          formats: ['cjs'],
          fileName: () => 'index.js'
        }
        external = ['koishi', 'cheerio', 'temporal-polyfill']
      }
      return {
        define: {
          'import.meta.env.TARGET': JSON.stringify(target)
        },
        build: {
          rollupOptions: { external }
        }
      }
    },
    resolveId(source) {
      if (map.has(source)) { return source }
      if (target === 'server' && source === 'vue') {
        return source
      }
    },
    load(id) {
      if (id === 'vue') {
        return this.resolve(id).then(async ({ id }) => {
          const Vue = await import(`file:///${id}`)
          const { func, other } = Object.groupBy(Object.keys(Vue), key => {
            return typeof Vue[key] === 'function' ? 'func' : 'other'
          })
          return `\
export { ${other.join(', ')} } from ${JSON.stringify(id)}
import * as Vue from ${JSON.stringify(id)}
export const { ${func.join(', ')} } = Vue
`
        })
      }
      return map.get(id)
    },
    transformIndexHtml(html, ctx) {
      if (target === 'pages') {
        return [{ tag: 'link', injectTo: 'head', attrs: { rel: 'icon', href: './favicon.svg' } }]
      }
    }
  }
}

const meta = (): Plugin => {
  return {
    name: 'meta',
    resolveId(source) {
      if (source.startsWith('meta:')) { return source }
    },
    load(id, options) {
      if (!id.startsWith('meta:')) { return }
      const [, name, content = 'content'] = id.match(/^meta:([^/]+)(?:\/([^/]+))?$/)!
      return `\
import { keys } from 'bind:Object'
import { getOwn } from 'bind:utils'
import { escapeAttr } from '@/bind'
export default function* (record) {
  for (const key of keys(record)) {
    const value = getOwn(record, key)
    if (value == null) { continue }
    yield \`<meta ${name}="\${escapeAttr(key)}" ${content}="\${escapeAttr(value)}">\`
  }
}`
    }
  }
}

export default defineConfig({
  appType: 'spa',
  base: './',
  root: 'src',
  publicDir: '../public',
  cacheDir: '../node_modules/.vite',
  resolve: {
    alias: { '@': resolve('./src') },
    extensions: ['.js', '.ts', '.json', '.vue']
  },
  build: {
    outDir: '../dist',
    assetsDir: '.assets',
    emptyOutDir: false,
    target: 'esnext',
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    minify: false,
    // ssrManifest: '_manifest.ssr.json',
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      external: [/^(?=node:)/],
      output: {
        minifyInternalExports: false
      }
    }
  },
  ssr: { noExternal: /^(?!node:)/ },
  plugins: [
    vue(),
    destroyModulePreload(),
    externalAssets(),
    buildTarget(),
    meta(),
    bindScript(),
    {
      name: 'view-ui-plus',
      enforce: 'pre',
      apply: 'build',
      resolveId(source) {
        if (source === 'view-ui-plus') { return source }
      },
      load(id) {
        if (id === 'view-ui-plus') {
          return `\
export * from 'view-ui-plus/src/components/index'
import pkg from 'view-ui-plus/package.json'
export const version = pkg.version`
        }
      }
    }
  ]
})
