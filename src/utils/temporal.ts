
import { call } from 'bind:core'
import { $then, match, replace } from 'bind:utils'
import { padStart, indexOf } from 'bind:String'
import { voidPromise } from '@/bind'
import { Temporal as T, ready as readyTemporal } from '@/deps/temporal'
let Now: typeof T.Now
let Duration: typeof T.Duration
let PlainDate: typeof T.PlainDate
let Instant: typeof T.Instant
let toZonedDateTimeISO: T.Instant['toZonedDateTimeISO']
export const ready = $then(readyTemporal ?? voidPromise, _ => {
  void ({ Now, Duration, PlainDate, Instant } = T)
  void ({ toZonedDateTimeISO } = Instant.prototype)
})

type SmallestUnit = T.ToStringPrecisionOptions['smallestUnit'] & T.TimeUnit
const autoSmallestUnitList: SmallestUnit[] = ['nanosecond', 'microsecond', 'millisecond', 'second']
const autoSmallestUnit = (date: T.ZonedDateTime | T.PlainDateTime | T.PlainTime) => {
  for (const unit of autoSmallestUnitList) {
    if (date[unit] != 0) { return unit }
  }
  return 'minute'
}
export const instantToString = (input: T.Instant | string | bigint | number | null, hour30 = false): string => {
  if (input == null) { return '' }
  let instant: T.Instant
  switch (typeof input) {
    case 'number': instant = Instant.fromEpochMilliseconds(input); break
    case 'bigint': instant = Instant.fromEpochNanoseconds(input); break
    case 'string': instant = Instant.from(input); break
    case 'object': instant = input; break
    default: return ''
  }
  let date: T.ZonedDateTime = call(toZonedDateTimeISO, instant, Now.timeZoneId())
  if (hour30) { date = date.withTimeZone(date.offset).add({ hours: -6 }) }
  let string = date.toString({ smallestUnit: autoSmallestUnit(date), timeZoneName: 'never' })
  if (hour30) { string = replace(/T([0-2]\d)/, string, (_, $1) => `T${padStart((+$1 + 6) as any, 2, '0')}`) }
  return string
}

export const formatDuration = (_seconds: number) => {
  const { hours, minutes, seconds } = Duration.from(`PT${+_seconds}S`).round({ largestUnit: 'hour', smallestUnit: 'second' })
  let ret = `${hours}:${minutes}:${seconds}`
  ret = replace(/(?<=^|:)(?=\d(?::|$))/g, ret, '0')
  ret = replace(/^0+:/, ret, '')
  return ret
}
const monthNamesShort = 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec'
export const parseRfc2822Date = (input: string): string | null => {
  const m = match(/^([A-Z][a-z]{2})\s+(\d+),\s+(\d+)$/, input)
  if (m == null) { return null }
  const month = indexOf(monthNamesShort, m[1]) / 4 + 1
  if (!(month > 0)) { return null }
  return new PlainDate(+m[3], +month, +m[2]).toString()
}