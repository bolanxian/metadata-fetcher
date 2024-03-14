/**
 * Base on <https://github.com/Colerar/abv/blob/main/src/lib.rs>
 */
import { $string } from '../bind'
const { indexOf } = $string
const int = BigInt, { asUintN } = int

const BASE = 58n
const MAX = 1n << 51n
const MASK = MAX - 1n
const XOR = 0x1552356C4CDBn
const table = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf'

export const encode = (aid: string | number | bigint) => {
  aid = int(aid)
  if (!(aid > 0n && aid < MAX)) { return }
  let tmp = asUintN(52, aid | MAX) ^ XOR
  let x = ['0', '0', '0', '0', '0', '0', '0', '0', '0'], i = 0
  while (tmp > 0n) {
    x[i++] = table[(tmp % BASE) as any]
    tmp /= BASE
  }
  return `BV1${x[2]}${x[4]}${x[6]}${x[5]}${x[7]}${x[3]}${x[8]}${x[1]}${x[0]}`
}

export const decode = (x: string) => {
  let tmp = 0n
  for (const y of [x[9], x[7], x[5], x[6], x[4], x[8], x[3], x[10], x[11]]) {
    let i = indexOf(table, y)
    if (i < 0) { return }
    tmp = tmp * BASE + int(i)
  }
  if (tmp >> 51n == 1n) {
    let aid = (tmp & MASK) ^ XOR
    if (aid > 0) {
      return `av${aid}`
    }
  }
}
