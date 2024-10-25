import { Temporal } from 'temporal-polyfill'
import { call, $string, replace } from '../bind'
const { padStart } = $string
const { Now, Instant, Duration } = Temporal

type SmallestUnit = Temporal.ToStringPrecisionOptions['smallestUnit'] & Temporal.TimeUnit
const autoSmallestUnitList: SmallestUnit[] = ['nanosecond', 'microsecond', 'millisecond', 'second']
const autoSmallestUnit = (date: Temporal.ZonedDateTime | Temporal.PlainDateTime | Temporal.PlainTime) => {
  for (const unit of autoSmallestUnitList) {
    if (date[unit] != 0) { return unit }
  }
  return 'minute'
}
const { toZonedDateTimeISO } = Instant.prototype
export const instantToString = (input: Temporal.Instant | string | bigint | number | null, hour30 = false): string => {
  if (input == null) { return '' }
  let instant: Temporal.Instant
  switch (typeof input) {
    case 'number': instant = Instant.fromEpochMilliseconds(input); break
    case 'bigint': instant = Instant.fromEpochNanoseconds(input); break
    case 'string': instant = Instant.from(input); break
    case 'object': instant = input; break
    default: return ''
  }
  let date = call(toZonedDateTimeISO, instant, Now.timeZoneId())
  if (hour30) { date = date.withTimeZone(date.offset).add({ hours: -6 }) }
  let string = date.toString({ smallestUnit: autoSmallestUnit(date), timeZoneName: 'never' })
  if (hour30) { string = replace(/T([0-2]\d)/, string, (_, $1) => `T${padStart((+$1 + 6) as any, 2, '0')}`) }
  return string
}

export const formatDuration = (_seconds: number) => {
  const { hours, minutes, seconds } = Duration.from(`PT${_seconds}S`).round({ largestUnit: 'hour', smallestUnit: 'second' })
  let ret = `${hours}:${minutes}:${seconds}`
  ret = replace(/(?<=^|:)(?=\d(?::|$))/g, ret, '0' as any)
  ret = replace(/^0+:/, ret, '' as any)
  return ret
}