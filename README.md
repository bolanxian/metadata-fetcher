# Metadata Fetcher

[![License](https://img.shields.io/badge/License-MPL%202-informational)](https://www.mozilla.org/en-US/MPL/2.0/)
[![License](https://img.shields.io/badge/License-PolyForm%20Noncommercial-informational)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![License](https://img.shields.io/badge/License-Anti%20996-informational)](https://github.com/kattgu7/Anti-996-License/blob/master/LICENSE)
[![License](https://img.shields.io/badge/License-Anti%20Capitalist-informational)](https://anticapitalist.software/)

### [元数据获取&借物表生成](https://t.bilibili.com/1098703443830243382)
只要输入ID(av号、BV号等)或链接  
就可以获取元数据或生成借物表  

### 下载
- [Gitee](https://gitee.com/bolanxian/metadata-fetcher/releases)
- [百度网盘](https://pan.baidu.com/s/1MAvtaVs9RA0tWvReXNj__w?pwd=rc18)

下载并解压后，双击`run.bat`启动  
启动完成后会有提示，并显示托盘图标  
点击托盘图标打开WebUI  

### 支持
| 运行环境 | 托盘图标 | WebUI | CLI |
| - | - | - | - |
| [Node.js](https://nodejs.org/) | ❌ | <span title="基于 @hono/node-server">✔️*</span> | ✔️ |
| [Deno](https://deno.com/) | ✔️ | ✔️ | ✔️ |
| [Bun](https://bun.com/) | ❌ | ✔️ | ✔️ |

### CLI / WebUI
```batch
::构建
bun run build

::运行 WebUI
deno task serve
deno task serve:bun

::获取元数据
deno task fetch [...]
::批量模式
deno task batch <".id" | "list" | "name" | ...> [...]

::完整构建
bun create https://github.com/bolanxian/metadata-fetcher/
cd metadata-fetcher
bun run build && bun run crate && bun run convert:ico
start "" deno run --no-prompt -P=start ./lib/main.ts start
```

### 小小容器
可通过[小小容器](https://github.com/Cateners/tiny_container/)，在 Android 上运行
```bash
#依赖
sudo apt update
sudo apt install nodejs npm
npm i -g deno

#运行 WebUI
deno task serve

#创建 .desktop 文件（用于桌面捷径）
deno task tiny:desktop
```

### Koishi
可安装为 [Koishi](https://koishi.chat/zh-CN/) 插件
```batch
bun run build:koishi
cd koishi-plugin
bun pm pack

cd <koishi-desktop>\data\instances\default
yarn add ./koishi-plugin-metadata-fetcher-<version>.tgz
```

### 许可证

本项目采用**多许可证叠加**模式，所有许可证**同时**适用于整个项目。使用、复制、修改、分发本项目的任何部分，均视为**同时接受下列全部许可证条款**的约束。任一条款的限制均不可被其他条款豁免。

#### 1. MPL-2.0（Mozilla Public License 2.0）

- **核心授权**：源码可用、修改、分发（含商业使用），文件级弱 copyleft——衍生文件须以 MPL-2.0 开源。
- **官方文本**：<https://www.mozilla.org/en-US/MPL/2.0/>

```
Mozilla Public License Version 2.0
==================================

This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://www.mozilla.org/MPL/2.0/.
```

#### 2. PolyForm Noncommercial License 1.0.0

- **核心限制**：禁止任何商业目的的使用、复制、修改、分发。
- **官方文本**：<https://polyformproject.org/licenses/noncommercial/1.0.0/>

```
PolyForm Noncommercial License 1.0.0
=====================================

This software and its documentation are licensed under the PolyForm
Noncommercial License, version 1.0.0. You may not use, copy, modify,
distribute, or sublicense this software for any commercial purpose.
A "commercial purpose" is one whose primary intent is commercial
advantage or monetary compensation.

For the full license terms, see:
https://polyformproject.org/licenses/noncommercial/1.0.0/
```

#### 3. Anti 996 License Version 1.0 (Draft)

- **核心限制**：禁止违反劳动法（如 996 工作制）的实体或个人使用本项目。
- **官方文本**：<https://github.com/kattgu7/Anti-996-License>

```
Anti 996 License Version 1.0 (Draft)
=====================================

The above license is granted under the condition that the license
holder or any organization or individual using the licensed work
shall not violate any laws and regulations related to labor and
employment, including but not limited to "996" working-hour systems.

For the full license terms (DRAFT version), see:
https://github.com/kattgu7/Anti-996-License/blob/master/LICENSE
```

#### 4. Anti-Capitalist Software License (v1.4)

- **核心限制**：禁止符合"资本主义主体"定义（超过规模上限的企业或以资本增值为主要目的者）使用本项目。
- **官方文本**：<https://anticapitalist.software/>

```
Anti-Capitalist Software License v1.4
======================================

This software is licensed under the Anti-Capitalist Software License
v1.4. Capitalist entities may not use this software. A capitalist
entity is one that, in its primary mode of operation, generates
revenue through the exploitation of waged labor, or one that, by
its primary nature, seeks to maximize owner profit by extracting
surplus value from workers.

For the full license terms, see:
https://anticapitalist.software/
```

### 许可证叠加效力说明

> ⚠️ **重要**：本项目同时适用上述全部许可证，叠加后整体效果如下表所示。任何下游使用者必须同时满足所有许可证的要求，**任一许可证的限制均不可被其他许可证豁免**。

| 维度 | 叠加后效果 |
|---|---|
| 源码可见 | ✅ 允许 |
| 修改与分发 | ⚠️ 仅在满足所有限制的前提下 |
| 商业使用 | ❌ 禁止（受 PolyForm-NC 与 ACSL 限制） |
| 文件级 copyleft | ✅ MPL-2.0 要求衍生文件开源 |
| 劳动法合规 | ❌ 违反劳动法（如 996）的主体禁用 |
| 主体资格限制 | ❌ "资本主义主体"禁用（ACSL） |
