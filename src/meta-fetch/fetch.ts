
export let $fetch: typeof fetch = null!
export let userAgent: string = null!
export let initFetch = (_fetch: typeof fetch, _userAgent: string) => {
  initFetch = null!
  $fetch = _fetch
  userAgent = _userAgent
}

const _headers = {
  'accept-language': '*',
  'user-agent': userAgent
}
const _init: RequestInit = {
  headers: _headers,
  method: 'GET',
  referrerPolicy: 'no-referrer',
  redirect: 'manual',
  credentials: 'omit'
}
export const htmlInit = {
  ..._init,
  headers: {
    ..._headers,
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
  }
}
export const jsonInit = {
  ..._init,
  headers: {
    ..._headers,
    'accept': 'application/json, text/plain, */*'
  }
}

export const redirect = async (url: string) => {
  const resp = await $fetch(url, htmlInit)
  const { headers } = resp
  return headers.get('location')
} 