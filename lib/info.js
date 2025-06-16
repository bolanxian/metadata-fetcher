import { cpus, release, freemem, totalmem } from 'node:os'
import { platform, arch, versions, env, memoryUsage } from 'node:process'
import { $string, hasOwn } from '../dist/main.ssr.js'
const { keys, values } = Object
const { indexOf, lastIndexOf, replaceAll, slice, split, startsWith, toUpperCase } = $string

const parseVersion = (value) => {
  let offset = indexOf(value, ' ')
  if (offset > 0) { value = slice(value, 0, offset) }
  offset = lastIndexOf(value, '/')
  let name = slice(value, 0, offset)
  let version = slice(value, offset + 1)
  return { name, version }
}

export const getCpu = () => {
  const map = { __proto__: null }, ret = []
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
  let name = platform
  let version = release()
  if (startsWith(name, 'win')) {
    let $ = split(version, '.')
    let suffix = ''
    if ($[0] === '10' && $[1] === '0') {
      suffix = +$[2] >= 22000 ? ' 11' : ' 10'
    }
    name = `Windows${suffix}`
  } else {
    name = `${toUpperCase(name[0])}${slice(name, 1)}`
  }
  return { name, arch, version }
}
export const getRuntime = () => {
  switch (`${+hasOwn(versions, 'deno')}:${+hasOwn(versions, 'bun')}`) {
    case '0:0': return { name: 'Node.js', version: versions.node }
    case '1:0': return { name: 'Deno', version: versions.deno }
    case '0:1': return { name: 'Bun', version: versions.bun }
  }
  return null
}
export const getPm = (key = 'npm_config_user_agent') => {
  let value = hasOwn(env, key) ? env[key] : null
  if (value == null) { return null }
  let agent = parseVersion(value)
  switch (agent.name) {
    case 'npminstall': agent.name = 'cnpm'; break
    case 'yarn': agent.name = 'Yarn'; break
  }
  return agent
}
