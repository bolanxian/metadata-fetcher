
import process from 'node:process'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

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
  for (const name of ['countup.js', 'dayjs', 'numeral']) {
    map.set(name, 'export default null')
  }
  let target
  return {
    name: 'target',
    enforce: 'pre',
    apply: 'build',
    config(config, { isSsrBuild }) {
      target = !isSsrBuild ? process.env.VITE_TARGET ?? 'client' : 'server'
      let outDir = config.build?.outDir
      let assetsDir = '.assets'
      if (target == 'client') {
        map.set('cheerio', 'export let load')
      } else if (target == 'pages') {
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
    },
    load(id) {
      return map.get(id)
    },
    transform(code, id, options) {
      if (target === 'koishi' && id.endsWith('.vue.ts')) {
        return `${code.slice(0, code.indexOf('/*<component>*/'))}export default null`
      }
    },
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
    extensions: ['.js', '.ts', '.json', '.vue']
  },
  build: {
    outDir: '../dist',
    emptyOutDir: false,
    target: 'esnext',
    modulePreload: { polyfill: true },
    cssCodeSplit: false,
    minify: false,
    //ssrManifest:'manifest.ssr.json',
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
