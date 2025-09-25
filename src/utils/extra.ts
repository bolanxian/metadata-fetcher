
import { defineComponent, onBeforeUnmount, onMounted, shallowReactive, createVNode as h } from 'vue'
import { Card, Cell, CellGroup } from 'view-ui-plus'
import { Temporal } from '@/deps/temporal'
import { getOwn, on } from 'bind:utils'
import { toFixed } from 'bind:Number'
import { from } from 'bind:Array'
import { values } from 'bind:Object'
import { discoverList, defineDiscover } from '@/meta-fetch/discover'
import { definePlugin, definePluginComponent } from '@/meta-fetch/plugin'
const TARGET = import.meta.env.TARGET
const SSR = TARGET == 'server'
const CSR = TARGET == 'client'
const { parse } = JSON
const defaultFetch = async () => ({})

defineDiscover({
  name: '',
  discover: [/^discover$/],
  handle: m => 'extra/discover/'
})
const discover = definePlugin<{}>({
  name: '', path: 'extra/discover',
  resolve(path) {
    if (!(path.length === 1 && path[0] === '')) { return }
    const id = 'discover'
    return { id, displayId: id, cacheId: id, shortUrl: '', url: '' }
  },
  fetch: defaultFetch,
  parse: () => ({ title: '发现' })
})
definePluginComponent(discover, defineComponent({
  render() {
    return [
      h(Card, { title: '发现' }, () => [
        h(CellGroup, null, () => from(discoverList, discover => {
          if (!discover.name) { return null }
          const include = getOwn(discover, 'discover')
          if (include == null) { return null }
          return from(include, reg => h(Cell, {
            title: `/${reg.source}/`, label: discover.name
          }))
        }))
      ]),
      h(Card, { title: '发现(HTTP)' }, () => [
        h(CellGroup, null, () => from(discoverList, discover => {
          if (!discover.name) { return null }
          const include = getOwn(discover, 'discoverHttp')
          if (include == null) { return null }
          return from(include, reg => h(Cell, {
            title: `/${reg.source}/`, label: discover.name
          }))
        }))
      ])
    ]
  }
}))

SSR || CSR ? defineDiscover({
  name: '',
  discover: [/^info$/],
  handle: m => 'extra/info/'
}) : null!
const info = SSR || CSR ? definePlugin<{}>({
  name: '', path: 'extra/info',
  resolve(path) {
    if (!(path.length === 1 && path[0] === '')) { return }
    const id = 'info'
    return { id, displayId: id, cacheId: id, shortUrl: '', url: '' }
  },
  fetch: defaultFetch,
  parse: () => ({ title: '系统信息' })
}) : null!
SSR || CSR ? definePluginComponent(info, defineComponent(SSR ? {
  props: null!,
  render: () => [null]
} : {
  props: null!,
  setup(props, ctx) {
    type VersionInfo = Record<'name' | 'version', string>
    type Info = {
      remoteAddr: string
      cpu: string[]
      os: Record<'arch', string> & VersionInfo
      runtime: VersionInfo | null
      pm: VersionInfo | null
    }
    type Usage = {
      cpu: Record<'used' | 'total', number>
      memory: Record<'app' | 'used' | 'total', number>
    }
    const data = shallowReactive<{
      source: EventSource | null
      info: | Info | null
      usage: Usage | null
    }>({
      source: null,
      info: null,
      usage: null
    })
    onMounted(() => {
      const source = data.source = new EventSource('./.info')
      on(source, 'info', e => {
        data.info = parse((e as MessageEvent<string>).data)
      })
      on(source, 'usage', e => {
        data.usage = parse((e as MessageEvent<string>).data)
      })
      on(source, 'error', e => {
        data.usage = null
      })
    })
    onBeforeUnmount(() => {
      data.source?.close()
    })
    const MiB = 1024 * 1024
    const GiB = 1024 * 1024 * 1024
    return () => [data.source != null ? h(Card, null, () => [
      h(CellGroup, null, () => {
        if (data.info == null) { return [] }
        const { remoteAddr, cpu, os, runtime, pm } = data.info
        return [
          h(Cell, { title: remoteAddr, label: 'IP' }),
          ...from(cpu, cpu => h(Cell, { title: cpu, label: 'CPU' })),
          h(Cell, { title: `${os.name} (${os.arch}) ${os.version}`, label: '操作系统' }),
          runtime != null ? h(Cell, { title: runtime.name, label: runtime.version }) : null,
          pm != null ? h(Cell, { title: pm.name, label: pm.version }) : null
        ]
      }),
      h(CellGroup, null, () => {
        if (data.usage == null) { return [] }
        const { cpu, memory } = data.usage
        return [
          h(Cell, { label: 'CPU', title: `${toFixed((cpu.used / cpu.total) * 100, 2)}%` }),
          h(Cell, {
            label: '内存', title: `\
${toFixed(memory.app / MiB, 2)}MiB/\
${toFixed(memory.used / GiB, 2)}GiB/\
${toFixed(memory.total / GiB, 2)}GiB (\
${toFixed((memory.app / memory.total) * 100, 2)}%/\
${toFixed((memory.used / memory.total) * 100, 2)}%\
)`
          })
        ]
      }),
    ]) : null]
  }
})) : null!

SSR || CSR ? defineDiscover({
  name: '',
  discover: [/^software$/],
  handle: m => 'extra/software/'
}) : null!
type Software = Record<string, { name: string, version: string, path: string }>
const software = SSR || CSR ? definePlugin<Software>({
  name: '', path: 'extra/software',
  resolve(path) {
    if (!(path.length === 1 && path[0] === '')) { return }
    const id = 'software'
    return { id, displayId: id, cacheId: id, shortUrl: '', url: '' }
  },
  async fetch() {
    if (!SSR) { return }
    const cp = await import('node:child_process')
    const stream = await import('node:stream')
    const { stdout } = cp.spawn('./dist/reg-utils', ['software'], { stdio: ['ignore', 'pipe', 'inherit'] })
    const text = await new Response(stream.Readable.toWeb(stdout) as any).text()
    const data = parse(text)
    return data
  },
  parse: () => ({ title: '软件' })
}) : null!
SSR || CSR ? definePluginComponent(software, defineComponent({
  props: { data: null! },
  setup(props, ctx) {
    return () => h(Card, null, () => [
      h(CellGroup, null, () => from(values(props.data!), $ => h(Cell, {
        title: $.name, label: $.version
      })))
    ])
  }
})) : null!

defineDiscover({
  name: '',
  discover: [/^ice$/],
  handle: m => 'extra/ice/'
})
definePlugin<{ title: string, since: string, date: string }[]>({
  name: '', path: 'extra/ice',
  resolve(path) {
    if (!(path.length === 1 && path[0] === '')) { return }
    const id = 'ice'
    return { id, displayId: id, cacheId: id, shortUrl: '', url: '' }
  },
  async fetch(info) {
    const nowDate = Temporal.Now.plainDateISO('+0800').withCalendar('chinese')
    const nextChunjie = Temporal.PlainDate.from({
      year: +nowDate.year + 1, month: 1, day: 1, calendar: 'chinese'
    })
    const startThawing = nextChunjie.add({ months: -3 })

    const diffOpts: Temporal.DifferenceOptions<'day'> = { largestUnit: 'day', smallestUnit: 'day' }
    const dtfOpts: Intl.DateTimeFormatOptions = { dateStyle: 'long' }
    return [
      {
        title: '解冻开始',
        since: startThawing.since(nowDate, diffOpts).toLocaleString('zh'),
        date: startThawing.withCalendar('iso8601').toLocaleString('zh', dtfOpts)
      }, {
        title: '解冻完成',
        since: nextChunjie.since(nowDate, diffOpts).toLocaleString('zh'),
        date: nextChunjie.withCalendar('iso8601').toLocaleString('zh', dtfOpts)
      }
    ]
  },
  parse(data, info) {
    let desc = ''
    for (const { title, since, date } of data) {
      desc += `${title}：${date}（${since}）\n`
    }
    return {
      title: '解冻',
      description: desc
    }
  }
})
