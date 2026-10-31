<div align="center">

# 📋 Survey-Tool · 轻量级问卷调查系统

**部署在 Cloudflare Workers 上的极致轻量级问卷调查系统**

单文件 `worker.js` 实现全部功能 · 零依赖 · 零成本 · 复制粘贴即可上线

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Cloudflare Workers](https://img.shields.io/badge/Platform-Cloudflare%20Workers-F6821F.svg?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Storage: Workers KV](https://img.shields.io/badge/Storage-Workers%20KV-0051C3.svg)](https://developers.cloudflare.com/kv/)
[![Dependencies: Zero](https://img.shields.io/badge/Dependencies-Zero-brightgreen.svg)]()
[![Language: JavaScript](https://img.shields.io/badge/Language-JavaScript-F7DF1E.svg?logo=javascript&logoColor=black)]()

🔗 **官方仓库**：https://github.com/danjiangzhidian/Survey-Tool

</div>

---

## 📑 目录

- [✨ 核心特性](#-核心特性)
- [🚀 快速部署 · 方式一：网页控制台（推荐）](#-快速部署--方式一网页控制台推荐)
- [💻 方式二：wrangler 命令行部署](#-方式二wrangler-命令行部署)
- [🔄 使用流程](#-使用流程)
- [🛠️ 技术栈](#️-技术栈)
- [❓ 常见问题](#-常见问题)
- [📦 文件清单](#-文件清单)
- [📄 开源协议](#-开源协议)

---

## ✨ 核心特性

### 📂 存储与部署

- **纯 KV 存储**：免费额度完全够用（每天 10 万次读 / 1000 次写），无需 R2、D1 或任何外部数据库。
- **单文件部署**：核心逻辑仅约 1000 行，直接粘贴到 Cloudflare 控制台，5 分钟内即可搞定上线。

### 🛠️ 问卷编辑器（`/admin`）

- **灵活题型**：支持单选、多选、评分（★1-5 / 百分制）、文本、下拉框，支持随时增删改。
- **题目控制**：支持必填标记、选项自由增删，内置显示条件（逻辑跳题）功能。
- **自定义样式**：标题支持左/中/右对齐及自定义颜色，支持配置说明、答题口令与每 IP 限填一次。

### 📊 数据统计与导出

- **可视化统计**：自动生成每题作答人数、选项分布条形图与占比，评分题自动计算平均分与星级。
- **零依赖导出**：手写 zip + OOXML 实现，零依赖原生导出 Excel（.xlsx）及 CSV。
- **大数据分片**：超过 500 条自动生成分片下载索引页，修复 KV 翻页 1000 条截断问题，数据再多也不丢。

### 📱 丝滑的交互体验

- **填写端**：移动端自适应完美，评分题实时显示得分；未完成必填项时红色 Toast 提示并自动滚动到漏答题。
- **管理端**：局部跳转无整页刷新，配有顶部加载进度条；编辑未保存退出时触发弹窗保护；内置风格统一的自定义弹窗组件。

### 🔒 安全防护

- **会话管理**：管理密码登录 + 服务端会话（KV 存储，带过期时间，可选 20 分钟 - 2 小时）。
- **安全策略**：支持问卷独立口令保护，所有输出 HTML 自动转义，严格防范 XSS 攻击。

---

## 🚀 快速部署 · 方式一：网页控制台（推荐）

> 💡 适合所有人，无需任何命令行经验，全程在浏览器里点击即可完成。

### 📐 第 0 步 · 了解架构

Worker 跑业务逻辑，所有数据存在 Workers KV：

| KV 键 | 用途 |
| :--- | :--- |
| `survey:{id}` | 问卷配置 |
| `index` | 问卷列表索引 |
| `resp:{sid}:{时间}` | 每条提交 |
| `sess:{token}` | 管理登录会话 |

免费额度：**每天 10 万次读 / 1000 次写**，内部调查绰绰有余。

### 🔑 第 1 步 · 修改管理密码

修改 `worker.js` 第 11 行的管理密码（**默认 `1234`，部署前请务必修改**）：

```js
const ADMIN_PASSWORD = "1234";
```

改成你自己的强密码。

### 🗄️ 第 2 步 · 创建 KV

1. 登录 Cloudflare 控制台：[dash.cloudflare.com](https://dash.cloudflare.com)
2. 左侧菜单 ➜ **Storage & Databases** ➜ **KV** ➜ **Create namespace**
3. 名称填：`survey-kv` ➜ 创建 ✅

### ⚙️ 第 3 步 · 创建 Worker

1. 左侧菜单 ➜ **Compute (Workers)** ➜ **Create** ➜ **Create Worker**
2. 名称填：`survey`（随意）➜ **Deploy** 先部署默认代码

### 🔗 第 4 步 · 绑定 KV

进入刚创建的 Worker ➜ **Settings** ➜ **Bindings（绑定）**

1. **Add** ➜ **KV Namespace**
2. Variable name 填：`KV` ⚠️ **必须是 `KV` 这两个字母**
3. Namespace 选：`survey-kv`
4. **Save / Deploy** ✅

### 📝 第 5 步 · 部署代码

Worker 的 **Edit code（编辑代码）** 页面 ➜ 把 `worker.js` 的**全部内容**粘贴进去，覆盖原代码 ➜ **Deploy** ✅

### 🎉 第 6 步 · 开始使用

访问 `https://survey.你的子域.workers.dev/admin`，用你改过的密码登录，新建第一份问卷！

### 🌐 第 7 步 · （可选）绑定自定义域名

1. Worker ➜ **Settings** ➜ **Domains & Routes** ➜ **Add** ➜ **Custom domain**
2. 填入你域名下的子域名，如：`diaocha.你的域名.com`
3. Cloudflare 会自动添加 SSL 证书 🔒
4. 之后管理后台就是 `https://diaocha.你的域名.com/admin`

---

## 💻 方式二：wrangler 命令行部署

> 💡 适合习惯终端操作的人，改代码后一条命令重新部署。

**1️⃣ 安装并登录**

```bash
npm install -g wrangler
wrangler login   # 浏览器里授权
```

**2️⃣ 创建 KV namespace**

```bash
wrangler kv namespace create survey-kv
```

它会输出 `id`，记下来填进配置文件。

**3️⃣ 项目目录建 `wrangler.toml`**

```toml
name = "survey"
main = "worker.js"
compatibility_date = "2025-01-01"

[[kv_namespaces]]
binding = "KV"
id = "你的namespace ID"
```

**4️⃣ 部署**

```bash
wrangler deploy
```

**5️⃣ 绑域名**：在 `wrangler.toml` / `wrangler.json` 里加 `routes`，或去控制台页面绑定。

---

## 🔄 使用流程

| 角色 | 流程 |
| :--- | :--- |
| 👨‍💻 管理员 | `/admin` 登录 ➜ 新建问卷 ➜ 编辑题目 ➜ 保存 ➜ 复制分享链接发给填写者 |
| 📝 填写者 | 打开链接 ➜ （如设置了口令则输入口令）➜ 答题 ➜ 提交 |
| 📊 管理员 | 进入统计页查看结果，一键导出 xlsx / CSV |

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
| :--- | :--- | :--- |
| ⚡ 运行时 | Cloudflare Workers | 边缘计算，极速响应，免服务器 |
| 🗄️ 存储层 | Workers KV | 键值存储，高并发高读取，免数据库 |
| 🎨 前端框架 | 原生 JavaScript | 零框架、零依赖、零构建，首屏秒开 |
| 📄 Excel 导出 | 手写 zip + 内联 OOXML | 不依赖 SheetJS 等大型库，轻量纯净 |

---

## ❓ 常见问题

<details>
<summary><b>💾 填写人太多会超免费额度吗？</b></summary>

读（打开问卷/统计）免费额度每天 **10 万次**；写（提交）每天 **1000 次**。超过 1000 人/天提交才需要 $5/月的付费计划（1000 万次写/月），一般公司内部调查用不到。
</details>

<details>
<summary><b>📦 数据怎么备份？</b></summary>

统计页点 **下载 CSV** 即可获取该问卷全部原始数据。也可用 wrangler 批量导出 KV：

```bash
wrangler kv key list --binding KV
```
</details>

<details>
<summary><b>🌐 IP 是真实 IP 吗？</b></summary>

是。Worker 用 Cloudflare 回传的 `CF-Connecting-IP`，即填写人的真实公网 IP，比局域网版更准。
</details>

<details>
<summary><b>🛡️ "每IP限一次"防刷够吗？</b></summary>

对普通场景够用。但公网上有人换 IP 刷就防不住，需要更严的话可以开启 **答题口令** 功能。
</details>

<details>
<summary><b>🔑 管理密码忘了？</b></summary>

密码写在 `worker.js` 第 11 行，修改后**重新部署一次**即可，数据不受影响。
</details>

<details>
<summary><b>🔄 和本地局域网版数据能互通吗？</b></summary>

问卷配置 JSON 格式完全相同：本地 `surveys/*.json` 可在管理后台「新建问卷」后把题目重新录入（或写个导入接口）。已收集的 CSV 数据两边独立。
</details>

---

## 📦 文件清单

| 文件 | 说明 |
| :--- | :--- |
| `worker.js` | 🧩 全部源码（包含 Worker 后端 + 前端全量页面，单文件） |
| `部署教程.txt` | 📖 详细的部署步骤、自定义域名绑定与常见问题解答 |
| `README.md` | 📄 本项目简介（本文件） |

---

## 📄 开源协议

本项目基于 [MIT License](https://opensource.org/licenses/MIT) 开源，可自由使用、修改与分发。

## 💡 支持与反馈

如果这个项目帮到了你，欢迎 [提 Issue](https://github.com/danjiangzhidian/Survey-Tool/issues) 或点击 ⭐ **Star** 给予支持！

<div align="center">

**⭐ 觉得好用就点个 Star 吧 ⭐**

</div>
