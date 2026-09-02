
import { test, expect } from 'vitest'
import { resolve } from '../mod'


test('jmcomic', () => {
  for (const id of [
    'jm559501',
    'comic18j-test.test/album/559501',
    'https://comic18j-test.test/album/559501/'
  ]) {
    expect(resolve(id).id).toBe('jm559501')
  }
})
