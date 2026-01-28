import { cpus, release, freemem, totalmem } from 'node:os'
import { platform, arch, versions, env, memoryUsage } from 'node:process'
import { $string, hasOwn } from '@/main.ssr'
const { keys, values } = Object
const { indexOf, lastIndexOf, replaceAll, slice, split, startsWith, toUpperCase } = $string

const parseVersion = (value: string) => {
  let offset = indexOf(value, ' ')
  if (offset > 0) { value = slice(value, 0, offset) }
  offset = lastIndexOf(value, '/')
  const name = slice(value, 0, offset)
  const version = slice(value, offset + 1)
  return { name, version }
}

export const getCpu = () => {
  const map: Record<string, number> = { __proto__: null! }, ret: string[] = []
  for (const cpu of cpus()) {
    const model = replaceAll(cpu.model, '\0', '')
    map[model] = (map[model] ?? 0) + 1
  }
  for (const model of keys(map)) {
    ret[ret.length] = `[${map[model]}] ${model}`
  }
  return ret
}
export const getCpuUsage = () => {
  let idle = 0, total = 0
  for (const cpu of cpus()) {
    for (const time of values(cpu.times)) {
      total += time
    }
    idle += cpu.times.idle
  }
  return { idle, used: total - idle, total }
}
export const getMemoryUsage = () => {
  const total = totalmem()
  const used = total - freemem()
  const app = memoryUsage().rss
  return { app, used, total }
}
export const getOs = () => {
  let name: string = platform
  const version = release()
  if (startsWith(name, 'win')) {
    const $ = split(version, '.')
    let suffix = ''
    if ($[0] === '10' && $[1] === '0') {
      suffix = +$[2]! >= 22000 ? ' 11' : ' 10'
    }
    name = `Windows${suffix}`
  } else {
    name = `${toUpperCase(name[0]!)}${slice(name, 1)}`
  }
  return { name, arch, version }
}
export const getRuntime = () => {
  switch (`${+hasOwn(versions, 'deno')}:${+hasOwn(versions, 'bun')}`) {
    case '0:0': return { name: 'Node.js', version: versions.node }
    case '1:0': return { name: 'Deno', version: versions['deno'] }
    case '0:1': return { name: 'Bun', version: versions['bun'] }
  }
  return null
}
export const getPm = (key = 'npm_config_user_agent') => {
  const value = hasOwn(env, key) ? env[key] : null
  if (value == null) { return null }
  const agent = parseVersion(value)
  switch (agent.name) {
    case 'npminstall': agent.name = 'cnpm'; break
    case 'yarn': agent.name = 'Yarn'; break
  }
  return agent
}
