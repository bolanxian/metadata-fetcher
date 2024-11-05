# Metadata Fetcher

### CLI / WebUI
```batch
: 构建
npm run build

: 运行 WebUI
npm run serve
npm run serve:bun

: 获取元数据
deno task fetch ...
: 仅解析
deno task id ...
: 借物表
deno task list ...
: 文件名
deno task list ...
```

### Koishi 插件
```batch
: 构建
deno task build:koishi
npm pack -w koishi-plugin-metadata-fetcher

cd <koishi-app>
npm install koishi-plugin-metadata-fetcher-<version>.tgz
```
