/**
 * Base on <https://github.com/Colerar/abv/blob/main/src/lib.rs>
 */
import { $string, test } from '../bind'
const { indexOf, slice } = $string
const int = BigInt, { asUintN } = int

export const REG_AV = /^([aA][vV](?!0(?!$))\d{1,16})$/
export const REG_BV = /^([bB][vV]1(?:(?![_0OIl])\w){9})$/

const BASE = 58n
const MAX = 1n << 51n
const XOR = 0x1552356C4CDBn
const table = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf'

export const encode = (input: string | number | bigint) => {
  if (typeof input == 'string') {
    if (!test(REG_AV, input)) { return }
    input = slice(input, 2)
  }
  let aid = int(input)
  if (!(aid >= 0n && aid < MAX)) { return }
  let tmp = (aid | MAX) ^ XOR
  let x = ['0', '0', '0', '0', '0', '0', '0', '0', '0'], i = 0
  while (i < x.length) {
    x[i++] = table[(tmp % BASE) as any]
    tmp /= BASE
  }
  if (tmp > 0n) { return null }
  return `BV1${x[2]}${x[4]}${x[6]}${x[5]}${x[7]}${x[3]}${x[8]}${x[1]}${x[0]}`
}

export const decode = (x: string) => {
  if (!test(REG_BV, x)) { return }
  let tmp = 0n
  for (const y of [x[9], x[7], x[5], x[6], x[4], x[8], x[3], x[10], x[11]]) {
    let i = indexOf(table, y)
    if (i < 0) { return }
    tmp = tmp * BASE + int(i)
  }
  if (tmp >> 51n == 1n) {
    let aid = asUintN(51, tmp) ^ XOR
    return `av${aid}`
  }
  return null
}
