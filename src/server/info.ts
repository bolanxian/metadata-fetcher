
import { encodeText as encode } from 'bind:utils'
import { keys } from 'bind:Object'
import { map } from 'bind:Array'
import type { SortedMap } from '@/utils/sorted-map'
import { getSoftware } from '@/utils/reg-utils'
import { getCpu, getCpuUsage, getMemoryUsage, getOs, getRuntime, getPm } from '@/utils/info'
import { discoverMap, discoverHttpMap, discoverGlobalRegExp } from '@/meta-fetch/mod'
import { name, server, TYPE, types, $, isLocalHost, $error } from './core'
const { stringify } = JSON

$['info'] = ({ remoteAddr, request: { headers } }) => {
  if (!isLocalHost(remoteAddr, headers)) {
    return $error(403, name)
  }
  if (headers.get('accept') === 'text/event-stream') {
    let timer: ReturnType<typeof setTimeout>
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encode(`\
event: info
data: ${stringify({ remoteAddr, cpu: getCpu(), os: getOs(), runtime: getRuntime(), pm: getPm() })}

`))
        const fn = () => {
          controller.enqueue(encode(`\
event: usage
data: ${stringify({ cpu: getCpuUsage(), memory: getMemoryUsage() })}

`))
        }
        timer = setInterval(fn, 500)
        fn()
      },
      cancel(reason) {
        clearInterval(timer)
      }
    }), {
      headers: { server, [TYPE]: 'text/event-stream' }
    })
  }
  const data = {
    mapper(this: SortedMap<any, any>, reg: RegExp) {
      return `${this.getScore(reg) ?? null}:${reg.source}`
    }
  }
  return new Response(stringify({
    remoteAddr, cpu: getCpu(),
    cpuUsage: getCpuUsage(),
    memoryUsage: getMemoryUsage(),
    os: getOs(), runtime: getRuntime(), pm: getPm(),
    routeList: keys($),
    discoverGlobalRegExp: discoverGlobalRegExp?.source ?? null,
    sortedRegList: map([...discoverMap.keys()], data.mapper, discoverMap),
    sortedHttpRegList: map([...discoverHttpMap.keys()], data.mapper, discoverHttpMap),
  }), {
    headers: { server, [TYPE]: types.json }
  })
}
$['software'] = async ({ remoteAddr, request: { headers } }) => {
  if (!isLocalHost(remoteAddr, headers)) {
    return $error(403, name)
  }
  return new Response(await getSoftware(), {
    headers: { server, [TYPE]: types.json }
  })
}
