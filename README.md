# 📋 Survey-Tool · 轻量级问卷调查系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Cloudflare Workers](https://img.shields.io/badge/Platform-Cloudflare%20Workers-F6821F.svg)](https://workers.cloudflare.com/)
[![Dependencies: Zero](https://img.shields.io/badge/Dependencies-Zero-brightgreen.svg)]()
[![Language: JavaScript](https://img.shields.io/badge/Language-JavaScript-F7DF1E.svg)]()

> 一套部署在 **Cloudflare Workers** 上的极致轻量级问卷调查系统。
> 单文件 `worker.js` 实现全部功能，**零依赖、零成本**运行，不需要服务器和数据库，复制粘贴即可上线。

🔗 **官方仓库**：https://github.com/danjiangzhidian/Survey-Tool

---

## 📑 目录

- [✨ 核心特性](#核心特性)
- [🚀 快速部署](#快速部署)
- [🔄 使用流程](#使用流程)
- [🛠️ 技术栈](#技术栈)
- [📦 文件清单](#文件清单)
- [📄 开源协议](#开源协议)

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

## 🚀 快速部署

1. **修改密码**：打开 `worker.js`，修改第 11 行的后台管理密码：

   ```js
   const ADMIN_PASSWORD = "你的强密码";
   ```

2. **创建 KV**：进入 Cloudflare 控制台 ➜ **KV** ➜ **Create namespace**，命名为 `survey-kv`。
3. **创建 Worker**：进入 **Compute (Workers)** ➜ **Create Worker**。
4. **绑定 KV**：在 Worker 的 **Settings** ➜ **Bindings** 中添加 KV Namespace，变量名（Variable name）**必须填：`KV`**。
5. **部署代码**：点击 **Edit code**，粘贴修改后的 `worker.js` 代码，点击 **Deploy**。
6. **开始使用**：访问 `https://你的worker域名.workers.dev/admin`。

> 💡 **提示**：绑定自定义域名、常用问题排查等，详见随附的 `部署教程.txt`。

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

## 📦 文件清单

| 文件 | 说明 |
| :--- | :--- |
| `worker.js` | 全部源码（包含 Worker 后端 + 前端全量页面，单文件） |
| `部署教程.txt` | 详细的部署步骤、自定义域名绑定与常见问题解答 |
| `README.md` | 本项目简介（本文件） |

---

## 📄 开源协议

本项目基于 [MIT License](https://opensource.org/licenses/MIT) 开源，可自由使用、修改与分发。

## 💡 支持与反馈

如果这个项目帮到了你，欢迎 [提 Issue](https://github.com/danjiangzhidian/Survey-Tool/issues) 或点击 ⭐ **Star** 给予支持！
