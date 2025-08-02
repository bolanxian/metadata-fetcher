
import { defineDiscover } from '../discover'
defineDiscover({
  name: '',
  discover: [/^(?:web\+)?meta:\/(.+)$/],
  handle: m => m[1]
})
