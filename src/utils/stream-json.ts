
import { encodeText as encode } from 'bind:utils'
import { type ResolvedInfo, type ParsedInfo, xparse } from '@/meta-fetch/mod'
import { render } from '@/render'
const { stringify } = JSON

export type StreamJson = {
  resolved?: ResolvedInfo | null
  redirected?: ResolvedInfo | null
  parsed?: (ResolvedInfo & ParsedInfo) | null
  rended?: string | null
  error: { step: number, message: string } | null
}
export async function* parseToStreamJson(input: string) {
  let step = 0
  try {
    const [, resolved, redirected, , parsedPromise] = xparse(input)
    yield encode(`{
  "resolved":${stringify(resolved ?? null)}`)
    step = 1
    yield encode(`,
  "redirected":${stringify(await redirected ?? null)}`)
    step = 2
    const parsed = await parsedPromise
    yield encode(`,
  "parsed":${stringify(parsed ?? null)}`)
    step = 3
    yield encode(`,
  "rended":${stringify(parsed != null ? render(parsed) : null)}`)
    step = 4
    yield encode(`,
  "error":null
}`)
  } catch (e: any) {
    reportError(e)
    yield encode(`${step > 0 ? ',' : '{'}
  "error":${stringify({ step, message: e.message ?? 'unknown error' })}
}`)
  }
}
