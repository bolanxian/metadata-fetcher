
import process from 'node:process'
import type { Plugin } from 'vite'
import { defineConfig, createFilter } from 'vite'
import vue from '@vitejs/plugin-vue'

const externalAssets = (() => {
  const reg = /\/(ionicons)-[-\w]{8}\.((?!woff2)\S+)$/
  return {
    renderBuiltUrl(fileName, { type, hostId, hostType }) {
      if (hostType === 'css') {
        const m = fileName.match(reg)
        if (m != null) { return `data:text/plain,${m[1]}.${m[2]}` }
      }
      return { relative: true }
    },
    plugin: {
      name: 'external-assets',
      generateBundle(options, bundle) {
        for (const fileName of Object.keys(bundle)) {
          const m = fileName.match(reg)
          if (m != null) { delete bundle[fileName] }
        }
      }
    }
  }
})()

const buildTarget = (): Plugin => {
  const map = new Map()
  return {
    name: 'target',
    enforce: 'pre',
    apply: 'build',
    config(config, { isSsrBuild }) {
      const target = !isSsrBuild ? process.env.VITE_TARGET ?? 'client' : 'server'
      let outDir = config.build?.outDir
      let assetsDir = '.assets'
      if (target == 'client') {
        map.set('cheerio', 'export let load')
      } else if (target == 'pages') {
        outDir = '../dist-pages'
        assetsDir = 'assets'
      }
      return {
        define: {
          'import.meta.env.TARGET': JSON.stringify(target),
          'import.meta.env.PAGES': target == 'pages' ? 'true' : 'false'

        },
        build: {
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
    extensions: ['.js', '.ts', '.json', '.vue']
  },
  experimental: { renderBuiltUrl: externalAssets.renderBuiltUrl },
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
    externalAssets.plugin,
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
    },
    buildTarget()
  ]
})
