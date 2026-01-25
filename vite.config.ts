
import process from 'node:process'
import { hash } from 'node:crypto'
import { resolve, extname } from 'node:path/posix'
import type { ExternalOption } from 'rollup'
import type { Plugin, RenderBuiltAssetUrl, HtmlTagDescriptor } from 'vite'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
//@ts-ignore
import { bindScript } from 'bind-script/plugin.vite'
//@ts-ignore
import { $string, test } from 'bind-script/src/utils'

const compare: (a: string, b: string) => number = $string.localeCompare
const emptyModule = `/** @unreachable */\nexport default null`

const viewUiPlus = (): Plugin => {
  const filter = { id: /^view-ui-plus$/ }
  const prefix = '/node_modules/view-ui-plus/src/'
  const names = `\
Row,Col,Menu,Submenu,MenuItem,Card,CellGroup,Cell,\
Input,Checkbox,Select,Option,RadioGroup,Radio,ButtonGroup,Button,\
Alert,Divider,Drawer,Icon,Message,Modal,Poptip,SkeletonItem,Tag\
`
  return {
    name: 'view-ui-plus',
    enforce: 'pre',
    apply: 'build',
    resolveId: { filter, handler(id) { return id } },
    load: { filter, handler(id) { return `export * from 'view-ui-plus/src/components/index'` } },
    transform: {
      filter: { id: /\/node_modules\/view-ui-plus\// },
      handler(code, id) {
        if (id.endsWith(`${prefix}utils/index.js`)) { return `export const isClient = !import.meta.env.SSR` }
        if (id.endsWith(`${prefix}utils/date.js`)) { return emptyModule }
        if (id.endsWith(`${prefix}utils/dom.js`)) { return `export { on, off } from 'bind:utils'` }
        if (id.endsWith(`${prefix}components/index.js`)) {
          const re = RegExp(`^export \\{ default as (${names.replaceAll(',', '|')}) \\} from `)
          return code.split('\n').filter(line => test(re, line)).join('\n')
        }
      }
    }
  }
}

const meta = (): Plugin => {
  const filter = { id: /^meta:/ }
  return {
    name: 'meta',
    resolveId: { filter, handler(id) { return id } },
    load: {
      filter,
      handler(id, options) {
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
}

const destroyBuildImportAnalysis = (): Plugin => {
  const name = 'Destroy `vite:build-import-analysis`'
  const preloadHelperIdRE = /^\0vite\/preload-helper\.js$/
  const filter = { id: preloadHelperIdRE }
  const dynamicImportPrefixRE = /(?<!\w)__vitePreload(?=\s*\()/
  const transformChunkRE = /(?<!\w)__vitePreload\(\(\) => ([^,]+?),\s*__VITE_IS_MODERN__\?__VITE_PRELOAD__:void 0,\s*import\.meta\.url\)/g
  return {
    name,
    enforce: 'pre',
    apply: 'build',
    resolveId: { filter, handler(id) { return id } },
    load: { filter, handler(id) { return `export let __vitePreload` } },
    renderChunk(code, chunk) {
      if (!dynamicImportPrefixRE.test(code)) { return }
      return code.replace(transformChunkRE, '$1')
    }
  }
}

const externalAssets = (): Plugin => {
  const reg = /\/(ionicons)-[-\w]{8}\.(\S+?)(?:$|\?)/
  const fontType = 'woff2'
  const inject: HtmlTagDescriptor[] = []
  const renderBuiltUrl: RenderBuiltAssetUrl = (fileName, { type, hostId, hostType }) => {
    if (type === 'asset' && hostType === 'css') {
      const m = fileName.match(reg)
      if (m != null) {
        if (m[2] !== fontType) { return 'about:invalid' }
        const href = `./${fileName}`
        const type = `font/${fontType}`
        inject[inject.length] = {
          tag: 'link', injectTo: 'head', attrs: {
            rel: 'preload', crossorigin: !0, href, as: 'font', type
          }
        }
      }
    }
    return { relative: true }
  }
  return {
    name: 'external-assets',
    apply: 'build',
    config(config, env) {
      return { experimental: { renderBuiltUrl } }
    },
    generateBundle(options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        const m = fileName.match(reg)
        if (m != null && m[2] !== fontType) { delete bundle[fileName] }
      }
    },
    transformIndexHtml(html, ctx) { return inject }
  }
}

const buildTarget = (): Plugin => {
  const map = new Map<string, string>()
  const pre = '/** @unreachable */\n'
  for (const name of ['countup.js', 'numeral', 'dayjs', 'js-calendar', 'lodash.throttle']) {
    map.set(name, emptyModule)
  }
  map.set('vue', `export * from '@vue/runtime-dom'`)
  map.set('undici', `${pre}export let Client, interceptors, errors`)
  map.set('encoding-sniffer', `${pre}export let decodeBuffer, DecodeStream`)
  map.set('qrcode', `${pre}export let toDataURL`)
  map.set('cheerio', `${pre}export let load`)
  map.set('@xterm/xterm', `${pre}export let Terminal`)
  map.set('@xterm/addon-webgl', `${pre}export let WebglAddon`)

  let target: 'client' | 'server' | 'pages' | 'koishi'
  return {
    name: 'target',
    enforce: 'pre',
    apply: 'build',
    config(config, { mode, isSsrBuild }) {
      target = !isSsrBuild ? (process.env['VITE_TARGET'] as typeof target) ?? 'client' : 'server'
      let external: ExternalOption | undefined
      if (target == 'server') {
        map.delete('cheerio')
      } else if (target == 'client') {
        map.delete('qrcode')
        map.delete('@xterm/xterm')
        map.delete('@xterm/addon-webgl')
      } else if (target == 'pages') {
        map.delete('qrcode')
        config.build!.outDir = '../dist-pages'
        config.build!.assetsDir = 'assets'
      } else if (target == 'koishi') {
        config.build!.outDir = '../koishi-plugin'
        config.build!.lib = {
          entry: 'main.koishi.ts',
          formats: ['cjs'],
          fileName: () => 'index.js'
        }
        external = ['koishi', 'cheerio', 'temporal-polyfill']
      }
      return {
        define: {
          'import.meta.env.TARGET': JSON.stringify(target),
          'process.env.NODE_ENV': JSON.stringify(mode),
        },
        build: {
          rollupOptions: { external }
        }
      }
    },
    resolveId(source, importer, options) {
      if (map.has(source)) { return source }
    },
    load(id, options) {
      return map.get(id)
    },
    transform: {
      filter: { id: /\.vue$/ },
      order: 'post',
      handler(code, id, options) {
        if (target !== 'server') { return }
        return code.replace(/const _sfc_setup = _sfc_main\.setup|_sfc_main\.setup = (?=\(props, ctx\) => {)/g, ';')
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const tags: HtmlTagDescriptor[] = []
        for (const id of ctx.chunk?.imports ?? []) {
          tags[tags.length] = {
            tag: 'link', injectTo: 'head',
            attrs: { rel: 'modulepreload', crossorigin: !0, href: `./${id}` }
          }
        }
        if (target === 'pages') {
          tags[tags.length] = {
            tag: 'link', injectTo: 'head',
            attrs: { rel: 'icon', href: './favicon.svg' }
          }
        }
        const algo = 'sha256'
        const compare2: typeof compare = (a, b) => compare(extname(a), extname(b)) || compare(a, b)
        for (const href of Object.keys(ctx.bundle!).toSorted(compare2)) {
          const asset = ctx.bundle![href]!
          let data: string | Uint8Array
          switch (asset.type) {
            case 'chunk': data = asset.code; break
            case 'asset': data = asset.source; break
          }
          const integrity = `${algo}-${hash(algo, data, 'base64')}`.replace(/=+$/, '')
          tags[tags.length] = {
            tag: 'link', injectTo: 'head',
            attrs: { 'rel': '@app-asset', href, integrity }
          }
        }
        return tags
      }
    }
  }
}

export default defineConfig({
  appType: 'spa',
  root: 'src',
  base: './',
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
    modulePreload: false,
    cssCodeSplit: false,
    minify: false,
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      external: [/^(?=node:)/],
      output: {
        minifyInternalExports: false,
        manualChunks: (id, meta) => {
          if (id.includes('/node_modules/@vue/')) { return 'dep-vue' }
          if (id.includes('/node_modules/cheerio/')) { return 'dep-cheerio' }
        }
      }
    }
  },
  ssr: {
    resolve: { conditions: ['module', 'import', 'default'] },
    noExternal: true
  },
  plugins: [
    bindScript(),
    vue(),
    viewUiPlus(),
    meta(),
    destroyBuildImportAnalysis(),
    externalAssets(),
    buildTarget(),
  ]
})
