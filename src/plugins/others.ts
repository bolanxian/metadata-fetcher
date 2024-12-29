
import { Temporal } from 'temporal-polyfill'
import { definePlugin } from '../plugin'

definePlugin({
  include: [/^ice$/],
  resolve({ 0: id }) { return { id, rawId: id, shortUrl: '', url: '' } },
  async load(info) {
    const nowDate = Temporal.Now.plainDate('chinese')
    const nextChunjie = Temporal.PlainDate.from({
      year: +nowDate.year + 1, month: 1, day: 1, calendar: 'chinese'
    })
    const startThawing = nextChunjie.add({ months: -3 })

    const diffOpts: Temporal.DifferenceOptions<'day'> = { largestUnit: 'day', smallestUnit: 'day' }
    const dtfOpts: Intl.DateTimeFormatOptions = { dateStyle: 'long' }
    return {
      since: [
        startThawing.since(nowDate, diffOpts).toLocaleString('zh'),
        nextChunjie.since(nowDate, diffOpts).toLocaleString('zh')
      ],
      duration: nextChunjie.since(startThawing, diffOpts).toLocaleString('zh'),
      nextChunjie: nextChunjie.withCalendar('iso8601').toLocaleString('zh', dtfOpts),
      startThawing: startThawing.withCalendar('iso8601').toLocaleString('zh', dtfOpts)
    }
  },
  async parse(data, info) {
    return {
      title: '解冻',
      description: `
解冻开始：${data.startThawing}（${data.since[0]}）
解冻完成：${data.nextChunjie}（${data.since[1]}）
`
    } as any
  }
})