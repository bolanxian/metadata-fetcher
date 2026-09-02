
import { test, expect } from 'vitest'
import { resolve } from '../mod'


test('pixiv', () => {
  for (const id of [
    'pixiv!87104831',
    'pid=87104831',
    'pixiv://illusts/87104831',
    'www.pixiv.net/artworks/87104831',
    'www.pixiv.net/en/artworks/87104831'
  ]) {
    expect(resolve(id).id).toBe('pixiv!87104831')
  }
  expect(resolve('pixiv:87104831-0')).toMatchObject({
    id: 'pixiv!87104831-0',
    displayId: 'pixiv:87104831-0',
    cacheId: 'pixiv!87104831',
    url: 'https://www.pixiv.net/artworks/87104831'
  })
})
