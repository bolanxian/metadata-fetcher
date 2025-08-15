# Metadata Fetcher

### [元数据获取&借物表生成](https://t.bilibili.com/1098703443830243382)
只要输入ID(av号、BV号等)或链接  
就可以获取元数据或生成借物表  

### [下载](https://pan.baidu.com/s/1MAvtaVs9RA0tWvReXNj__w?pwd=rc18)
双击`run.bat`启动  
启动完成后会发出通知，并显示托盘图标  
点击托盘图标打开WebUI  

### 支持
| 运行环境 | 托盘图标 | WebUI | CLI |
| - | - | - | - |
| [Node.js](https://nodejs.org/) | ❌ | ❌ | ✔️ |
| [Deno](https://deno.com/) | ✔️ | ✔️ | ✔️ |
| [Bun](https://bun.com/) | ❌ | ✔️ | ✔️ |

### CLI / WebUI
```batch
::构建
npm run build

::运行 WebUI
npm run serve
npm run serve:bun

::获取元数据
deno task fetch [...]
::批量模式
deno task batch <".id" | "list" | "name" | ...> [...]
```

### Koishi 插件
```batch
deno task build:koishi
npm pack -w koishi-plugin-metadata-fetcher

cd <koishi-desktop>\data\instances\default
yarn add ./koishi-plugin-metadata-fetcher-<version>.tgz
```
