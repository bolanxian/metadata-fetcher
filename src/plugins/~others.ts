
import { type Prop, defineComponent, onBeforeUnmount, onMounted, shallowReactive, createVNode as h } from 'vue'
import { Card, Cell, CellGroup } from 'view-ui-plus'
import { Temporal } from 'temporal-polyfill'
import { on } from 'bind:utils'
import { toFixed } from 'bind:Number'
import { from } from 'bind:Array'
import { type Plugin, definePlugin } from '../plugin'
const TARGET = import.meta.env.TARGET
const SSR = TARGET == 'server'
const CSR = TARGET == 'client'
const { parse } = JSON
const defaultResolve: Plugin['resolve'] = ({ 0: id }) => ({ id, rawId: id, shortUrl: '', url: '' })

type Info = {}
const Info = SSR || CSR ? defineComponent(SSR ? {
  props: null! as { data: Prop<Info> },
  render: () => [null]
} : {
  props: null! as { data: Prop<Info> },
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
}) : null!
SSR || CSR ? definePlugin<Info>({
  include: [/^info$/],
  resolve: defaultResolve,
  async load(info) { return {} },
  async parse(data, info) {
    return { title: '系统信息' } as any
  },
  component: Info
}) : null

definePlugin<{ title: string, since: string, date: string }[]>({
  include: [/^ice$/],
  resolve: defaultResolve,
  async load(info) {
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
  async parse(data, info) {
    let desc = '\n'
    for (const { title, since, date } of data) {
      desc += `${title}：${date}（${since}）\n`
    }
    return {
      title: '解冻',
      description: desc
    } as any
  }
})
