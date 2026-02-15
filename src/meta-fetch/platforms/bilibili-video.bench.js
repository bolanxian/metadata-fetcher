
import { bench } from 'vitest'
import { resolve } from '../mod'
bench('av号', () => {
  resolve('av1')
})
bench('BV号', () => {
  resolve('raw!BV1xx411c7mQ')
})
bench('av2bv', () => {
  resolve('bv!av1')
})
bench('bv2av', () => {
  resolve('BV1xx411c7mQ')
})
