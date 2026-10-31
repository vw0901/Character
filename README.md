# Character · 小说设定圣经与 AI 文字冒险

输入一部小说，自动检索资料、生成结构化的「设定圣经」、体检设定漏洞，再以这部小说为舞台开始一段可选择的文字冒险。

前端使用 Next.js 静态导出，运行期由 FastAPI 同源托管；生产环境只需要 Python。

## 功能

- **检索**：按小说名搜索作者、状态、世界观等公开资料；未配置检索服务时由模型知识兜底。
- **设定圣经**：汇总世界观、力量体系、势力、人物、时间线、悬念与线索。
- **设定体检**：给出整体评分、逻辑漏洞与可执行的修复建议。
- **文字冒险**：选择或自定义角色，进入场景、做出选择，生命/战力/声望随之变化。
- **多服务商**：内置 OpenAI、DeepSeek、Ollama、火山方舟、阿里百炼、硅基流动、Moonshot、智谱预设，也可填任意 OpenAI 兼容接口。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16（App Router、静态导出）、React 19、TypeScript、Tailwind CSS 4 |
| 后端 | FastAPI、Pydantic、OpenAI Python SDK、httpx |
| 测试 | pytest、respx、TypeScript / ESLint / Stylelint |

## 目录结构

```
character/
├── backend/                    FastAPI 服务
│   ├── app/
│   │   ├── ai/                 OpenAI 客户端、检索、SSE、prompt
│   │   ├── routers/            /api/search、bible、check、game…
│   │   ├── static/             前端构建产物（由脚本生成，不提交）
│   │   └── main.py             应用入口与静态托管
│   ├── tests/                  pytest 契约测试
│   ├── mock_openai_server.py   本地 OpenAI 兼容 mock 服务
│   ├── requirements.txt        运行依赖
│   └── requirements-dev.txt    测试依赖
├── projects/                   Next.js 前端（仅构建期需要 Node.js）
│   ├── src/app/                页面、布局、全局样式
│   ├── src/components/         业务组件
│   └── src/lib/ai/             浏览器配置与 SSE 解析
├── start.ps1 / start.sh        一键启动
└── README.md
```

## 快速开始

前置条件：Python 3.12+；若需要构建前端，另需 Node.js 20.9+ 与 pnpm 9+。

**Windows**

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

**macOS / Linux**

```bash
chmod +x start.sh
./start.sh
```

首次运行会自动创建虚拟环境、安装依赖、生成 `backend/.env`、构建前端静态文件并同步到 `backend/app/static`，随后启动服务。

打开 <http://127.0.0.1:5000>，点击右上角「AI 设置」，填写 OpenAI 兼容服务的 Base URL、API Key 与模型名称即可。

常用参数：

| PowerShell / Bash | 说明 |
|---|---|
| `-Port 8000` / `--port 8000` | 监听端口，默认 `5000` |
| `-HostAddr 0.0.0.0` / `--host 0.0.0.0` | 监听地址，默认 `127.0.0.1` |
| `-Rebuild` / `--rebuild` | 强制重新构建前端 |

### 开发模式

开发模式可热更新，前端 `3000` 端口的 `/api` 会自动代理到后端 `8000`。

```powershell
# 终端 1：后端
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements-dev.txt
Copy-Item .env.example .env
.\run.ps1 -Port 8000 -Reload

# 终端 2：前端
cd projects
pnpm install
pnpm dev
```

Unix 下把 `pip`、`Copy-Item`、`run.ps1` 换成 `pip3`、`cp`、`./run.sh`，并设置 `PORT=8000 RELOAD=1`。

## 配置

### 浏览器内配置（推荐）

「AI 设置」页填写的配置保存在浏览器 `localStorage`，随每次 API 请求发送给本地后端，后端不落盘。页面提供「测试连接」「获取模型」「清除配置」。

### 后端环境变量（兜底）

未在浏览器保存配置时读取 `backend/.env`：

| 变量 | 默认 | 说明 |
|---|---|---|
| `OPENAI_BASE_URL` | 空 | OpenAI 兼容接口地址，缺少 `/v1` 时自动补全 |
| `OPENAI_API_KEY` | 空 | API Key；本地模型可留空 |
| `OPENAI_MODEL` | 空 | 模型名称 |
| `AI_SEARCH_PROVIDER` | `none` | `none` 或 `tavily` |
| `TAVILY_API_KEY` | 空 | 启用 Tavily 检索时必填 |
| `AI_TIMEOUT` | `300` | 单次 AI 请求超时（秒） |

也兼容 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL` 别名。可从 `.env.example` 复制：

```bash
cp backend/.env.example backend/.env
```

## 构建与部署

```powershell
# 构建前端并同步到后端静态目录
powershell -ExecutionPolicy Bypass -File .\start.ps1 -Rebuild -Port 8000
```

等价的手动步骤：

```powershell
cd projects
pnpm install
pnpm build
$static = Resolve-Path ..\backend\app\static
Get-ChildItem $static -Force | Where-Object Name -ne '.gitkeep' | Remove-Item -Recurse -Force
Copy-Item .\out\* $static -Recurse -Force

cd ..\backend
Copy-Item .env.example .env
.\run.ps1 -Port 5000
```

生产机只要 Python 与 `backend/app/static`，无需安装 Node.js。默认仅监听 `127.0.0.1`；若通过反向代理对外提供服务，请在代理层增加身份认证与 HTTPS。

## 测试

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements-dev.txt
.\.venv\Scripts\python -m pytest -q

cd ..\projects
pnpm install
pnpm validate
```

`backend/tests/fixtures/expected_messages.json` 保存了 prompt 的完整 messages 快照，`test_prompts.py` 会逐字段校验，避免改动 prompt 时悄悄改变行为。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/search` | 检索小说资料，返回 JSON |
| POST | `/api/bible` | 生成设定圣经，SSE |
| POST | `/api/check` | 设定漏洞体检，SSE |
| POST | `/api/game` | 生成游戏初始场景，SSE |
| POST | `/api/game/action` | 生成下一场景，SSE |
| POST | `/api/models` | 获取模型列表 |
| POST | `/api/ai/test` | 测试 AI 连接 |
| GET | `/healthz` | 健康检查 |

SSE 数据块为 `data: {"text":"..."}`，以 `data: [DONE]` 结束；错误块为 `data: {"error":"..."}`。接口文档见 `/docs`。

## 隐私与安全

- 仓库不包含 `.env`、API Key、虚拟环境、`node_modules` 或构建产物；`start` 脚本也不会写入任何凭据到版本库。
- 浏览器设置中的 API Key 仅保存在本机 `localStorage`，随请求发往**本机**后端；后端只在内存中使用，不写日志、不落盘。共用电脑请用「清除配置」。
- Tavily Key 只通过 `Authorization` 请求头发送。
- 未知异常只向前端返回通用提示，避免服务端响应片段或凭据被回显。
- 默认绑定 `127.0.0.1`，不对外网开放。如需公网访问，务必在反向代理层启用 HTTPS 与访问控制，并限制 `/docs` 与 `/openapi.json`。
- 若曾把 `.env` 或 Key 误提交到 Git，请立即在服务商侧吊销并轮换。

## 相关文档

- `projects/AGENTS.md`：前端编码与 UI 约定
- `projects/DESIGN.md`：视觉设计说明
