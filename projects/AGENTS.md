# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router，静态导出)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui（按需生成）
- **Styling**: Tailwind CSS 4
- **后端**: FastAPI（位于同级 `../backend/`，同源托管静态产物）

## 目录结构

```
├── public/                 # 静态资源
├── src/
│   ├── app/                # 页面路由与布局、全局样式
│   │   └── settings/       # AI 服务设置页
│   ├── components/         # 业务组件（UI 组件按需生成）
│   │   └── game/           # 冒险界面：角色选择、日志、状态条、选项与自填行动、结局与后日谈
│   └── lib/
│       ├── utils.ts        # 通用工具函数 (cn)
│       ├── ai/             # 浏览器 AI 配置、SSE 解析与错误文案
│       └── project/        # 存档类型、宽松解析（parse/）与本地读写
├── next.config.ts          # 静态导出（output: export）配置
├── components.json         # shadcn/ui 生成配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 前端仅做静态导出，API 由同级 `../backend/` 的 FastAPI 提供；生产运行时不依赖 Node.js。
- 冒险进度按角色保存在 `project.adventures`，角色键由 `characterKey()` 生成；改动存档结构时同步更新
  `lib/project/types.ts` 与 `backend/app/version.py` 的存档格式版本。
- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。
- 一键启动脚本与完整说明位于仓库根目录：`../start.py`、`../start.cmd`、`../README.md`。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 项目基于 shadcn/ui 规范，但 `src/components/ui/` 中的组件按需生成，不预置未使用的组件。
- 需要新组件时运行 `pnpm dlx shadcn@latest add <component>`，生成结果位于 `src/components/ui/`。
- 新增 UI **必须**遵循 shadcn/ui 的结构、命名与样式约定，**除非用户指定用其他的组件和规范。**
