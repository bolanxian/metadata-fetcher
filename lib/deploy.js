
/// <reference types="bun" />
import { $, fileURLToPath } from 'bun'
import { cwd } from 'node:process'
import { exists } from 'node:fs/promises'
import { relative } from 'node:path'
const { log } = console
if (!import.meta.main) { (void 0)() }
const root = fileURLToPath(new URL('../dist-pages/', import.meta.url))
$.cwd(root)

const remote = (await $`cd .. && git remote -v`.text())
  .match(/^origin\s+(\S+)\s+\(push\)$/m)[1]
log(`\
Local: ${relative(cwd(), root)}
Remote: ${remote}`)

if (await exists(`${root}.git`)) { (void 0)() }

if (confirm('继续？')) {
  await $`git init`
  await $`git add -A`
  await $`git commit -m "deploy"`
  await $`git push -f --progress ${remote} master:gh-pages`
}
