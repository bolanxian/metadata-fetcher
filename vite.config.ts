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
    assetsDir: '.assets',
    emptyOutDir: false,
    target: 'esnext',
    modulePreload: { polyfill: true },
    cssCodeSplit: false,
    minify: false,
    //ssrManifest:'manifest.ssr.json',
    rollupOptions: {
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
      // apply(config, { command }) {
      //   return command === 'build' && !config.build.ssr
      // },
      resolveId(source, importer, options) {
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
  ]
})
