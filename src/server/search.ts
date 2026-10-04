
import { test } from 'bind:utils'
import { trim } from 'bind:String'
import { P } from '@/components/app.vue'
import { type ResolvedInfo, cache, xresolve, resolve, tryRedirect } from '@/meta-fetch/mod'
import { name, url, server, TYPE, types, $, isLocalHost, $redirect } from './core'
import { renderToHtml } from './render'
const { stringify } = JSON

$['opensearch'] = (ctx) => {
  return new Response(`\
<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${name}</ShortName>
  <Description>获取元数据</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image type="${types.svg}">${url}.favicon</Image>
  <Url type="${types.html}" template="${url}.search?.={searchTerms}"/>
  <Url type="${types.suggest}" template="${url}.suggest?.={searchTerms}"/>
  <Url type="${types.trending}" template="${url}.suggest"/>
  <Url type="${types.osdx}" rel="self" template="${url}.opensearch"/>
</OpenSearchDescription>
`, {
    headers: { server, [TYPE]: types.osdx }
  })
}
const searchAsRedirect = async (redirected: Promise<ResolvedInfo | null>, input: string, base?: string | URL) => {
  const id = (await redirected)?.id
  if (id == null) { return renderToHtml('default', input) }
  return $redirect(new URL(`./.search?.=${encodeURIComponent(id)}`, base).href)
}
$['search'] = ({ url }) => {
  const input = trim(url.searchParams.get('.') ?? '')
  if (input === '') { return $redirect(new URL('./', url).href) }
  const resolved = resolve(input)
  let id = resolved?.id
  if (id != null) {
    const maybeRedirect = tryRedirect(resolved!)
    if (maybeRedirect != null) {
      return searchAsRedirect(maybeRedirect, input, url)
    }
    if (test(P, id)) {
      return $redirect(new URL(`./${encodeURIComponent(id)}`, url).href)
    }
  }
  return renderToHtml('default', input)
}
$['suggest'] = ({ url, remoteAddr, request: { headers } }) => {
  const _input = url.searchParams.get('.')
  const input = trim(_input ?? '')
  if (!input) {
    let list: string[] | undefined
    if (isLocalHost(remoteAddr, headers)) {
      list = [...cache.keys()]
    }
    const data = stringify([_input, list ?? []])
    return new Response(data, {
      headers: { server, [TYPE]: types.trending }
    })
  }
  const list = [...xresolve(input)], ids = []
  for (const { displayId } of list) {
    if (test(P, displayId)) { ids[ids.length] = displayId }
  }
  for (const { shortUrl } of list) {
    if (shortUrl) { ids[ids.length] = shortUrl }
  }
  for (const { url } of list) {
    ids[ids.length] = url
  }
  return new Response(stringify([_input, ids]), {
    headers: { server, [TYPE]: types.suggest }
  })
}
