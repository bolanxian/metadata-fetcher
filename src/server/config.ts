
import { config, readConfig, writeConfig } from '@/config'
import { FsCache, cache } from '@/meta-fetch/mod'
import {
  name, server, TYPE, types, $,
  isLocalHost, isLocalHostOrigin,
  $success, $error,
} from './core'
const { stringify } = JSON

$['config'] = async ({ request, remoteAddr }) => {
  const { headers } = request
  if (request.method === 'POST') {
    if (!isLocalHostOrigin(remoteAddr, headers)) {
      return $error(403, name)
    }
    const $config: typeof config = { ...config, ...await request.json() }
    $config.browsers = config.browsers
    await writeConfig($config)
    return $success()
  }
  const $config = { ...await readConfig() }
  if (!isLocalHost(remoteAddr, headers)) {
    $config.browsers = null
    $config.defaultBrowser = null
  }
  return new Response(stringify($config), {
    headers: { server, [TYPE]: types.json }
  })
}
$['clear-lru'] = ({ remoteAddr, request }) => {
  const { headers } = request
  if (!(request.method === 'POST' && isLocalHostOrigin(remoteAddr, headers))) {
    return $error(403, name)
  }
  if (cache instanceof FsCache) {
    cache.lru.clear()
    return $success()
  }
  return $error(418, name)
}
$['reset-tray'] = async ({ remoteAddr, request }) => {
  const { headers } = request
  if (!(request.method === 'POST' && isLocalHostOrigin(remoteAddr, headers))) {
    return $error(403, name)
  }
  let data: any, ok = (_: any) => { data = _ }
  const e = new CustomEvent('server:reset-tray', { detail: ok, cancelable: true })
  dispatchEvent(e)
  if (e.defaultPrevented) {
    await data
    return $success()
  }
  return $error(418, name)
}
