# Metadata Fetcher

### 支持
| 运行环境 | 托盘图标 | WebUI | CLI |
| - | - | - | - |
| [Node.js](https://nodejs.org/) | ❌ | ❌ | ✔️ |
| [Deno](https://deno.com/) | ✔️ | ✔️ | ✔️ |
| [Bun](https://bun.com/) | ❌ | ✔️ | ✔️ |

### CLI / WebUI
```batch
: 构建
npm run build

: 运行 WebUI
npm run serve
npm run serve:bun

: 获取元数据
deno task fetch ...
: 批量模式
deno task batch <".id" | "list" | "name" | ...> ...
```

### Koishi 插件
```batch
: 构建
deno task build:koishi
npm pack -w koishi-plugin-metadata-fetcher

cd <koishi-desktop>\data\instances\default
yarn add ./koishi-plugin-metadata-fetcher-<version>.tgz
```
