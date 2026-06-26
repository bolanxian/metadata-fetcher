
import { assert, match } from 'bind:utils'
import { noop } from '@/bind'
import { defineDiscover } from '../discover'
import { definePlugin } from '../plugin'

defineDiscover({
  name: '',
  discover: [/^(?!noGlobal)(?:web\+)?meta:\/([!#$%&*+\-./:=?@\w~]+)$/],
  handle: m => m[1]
})

defineDiscover({
  name: 'Thunder Link Decode',
  discover: [/^(?!noGlobal)thunder:\/\/([+/0-9A-Za-z]+)={0,3}$/],
  handle: m => `thunder/decode/${m[1]}`
})
defineDiscover({
  name: 'Thunder Link Encode',
  discover: [/^(?!noGlobal)thunder-encode:(.*)$/],
  handle: m => `thunder/encode/${encodeURIComponent(m[1]!)}`
})
definePlugin({
  name: 'Thunder Link Decode',
  path: 'thunder/decode',
  resolve(path) {
    if (path.length !== 1) { return }
    assert?.<Record<0, string>>(path)
    const id = `thunder://${path[0]}`
    const decoded = decodeURIComponent(escape(atob(path[0])))
    const m = match(/^AA(.*)ZZ$/, decoded)
    if (m == null) { return }
    return { id, cacheId: '', displayId: id, shortUrl: '', url: m[1]! }
  },
  fetch: noop as any,
  parse: noop as any,
})
definePlugin({
  name: 'Thunder Link Encode',
  path: 'thunder/encode',
  resolve(path) {
    if (path.length !== 1) { return }
    assert?.<Record<0, string>>(path)
    const encoded = btoa(`AA${unescape(path[0])}ZZ`)
    const id = `thunder://${encoded}`
    return { id, cacheId: '', displayId: id, shortUrl: '', url: id }
  },
  fetch: noop as any,
  parse: noop as any,
})
