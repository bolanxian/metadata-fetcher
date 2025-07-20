
import process from 'node:process'
import { type Plugin, defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { bindScript } from 'bind-script/plugin.vite'
import { resolve } from 'node:path'

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
  map.set('@xterm/xterm', 'export let Terminal')
  map.set('@xterm/addon-webgl', 'export let WebglAddon')

  let target: 'client' | 'server' | 'pages' | 'koishi'
  return {
    name: 'target',
    enforce: 'pre',
    apply: 'build',
    config(config, { isSsrBuild }) {
      target = !isSsrBuild ? (process.env.VITE_TARGET as typeof target) ?? 'client' : 'server'
      let outDir = config.build?.outDir
      let assetsDir = '.assets'
      if (target == 'client') {
        map.delete('qrcode')
        map.delete('@xterm/xterm')
        map.delete('@xterm/addon-webgl')
        map.set('cheerio', 'export let load')
      } else if (target == 'pages') {
        map.delete('qrcode')
        outDir = '../dist-pages'
        assetsDir = 'assets'
      } else if (target == 'koishi') {
        outDir = '../koishi-plugin'
      }
      return {
        define: {
          'import.meta.env.TARGET': JSON.stringify(target)
        },
        build: {
          rollupOptions: {
            external: target == 'koishi' ? ['koishi', 'cheerio', 'temporal-polyfill'] : [],
          },
          lib: target == 'koishi' ? {
            entry: 'main.koishi.ts',
            formats: ['cjs'],
            fileName: () => 'index.js'
          } : void 0,
          outDir,
          assetsDir
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
    transform(code, id, options) {
      if (target === 'koishi' && id.endsWith('.vue.ts')) {
        return `${code.slice(0, code.indexOf('/*<component>*/'))}export default null`
      }
    },
    transformIndexHtml(html, ctx) {
      if (target === 'pages') {
        const svg = `\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -59 100 100">\
<text font-size="90" text-anchor="middle" dominant-baseline="middle">\
🔨\
</text>\
</svg>\
`
        const href = `data:image/svg+xml,${encodeURIComponent(svg)}`
        return [{ tag: 'link', injectTo: 'head', attrs: { rel: 'icon', href } }]
      }
    }
  }
}

// https://vitejs.dev/config/
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
    emptyOutDir: false,
    target: 'esnext',
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    minify: false,
    //ssrManifest:'manifest.ssr.json',
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
    externalAssets(),
    buildTarget(),
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
