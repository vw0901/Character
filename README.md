# 假如是你

> 输入一部小说，生成它的设定圣经，再以「你」为主角走进故事。

一个跑在自己电脑上的 AI 小工具：**搜资料 → 生成世界观/人物/势力 → 体检设定漏洞 → 自动修补 → 开始文字冒险**。整个过程会自动存档成一个 JSON 文件，随时可以接着玩。

当前版本：**v0.2.0**（变更见 [CHANGELOG.md](./CHANGELOG.md)）

## 一行启动

需要先安装 [Python 3.12+](https://www.python.org/downloads/)。

**Windows**：双击 `start.cmd`，或在终端执行：

```powershell
python start.py
```

**macOS / Linux**：

```bash
python3 start.py
```

首次启动会自动创建虚拟环境、安装依赖、生成配置并打开浏览器；以后同样一条命令即可。

想从零开始，也可以一行完成：

```bash
git clone https://github.com/vw0901/Character.git && cd Character && python start.py
```

启动后默认地址：<http://127.0.0.1:5000>

> 前端页面已经随仓库提供，**日常使用只需要 Python**，不需要 Node.js。

## 第一次使用

1. 打开页面，点右上角 **齿轮**。
2. 选一个服务商预设，或填任意 OpenAI 兼容接口。
3. 填 **Base URL、API Key、模型名**，点「测试连接」→「保存设置」。
4. 回到首页，输入小说名（如《三体》）→ 检索 → 生成设定圣经 → 漏洞体检（自动修补）→ 开始冒险。

**没有 API Key？**

- 本地装 [Ollama](https://ollama.com/)，选 `Ollama` 预设，Key 留空即可。
- 或使用 DeepSeek、智谱、硅基流动等服务商的兼容接口，填自己的 Key。

配置只保存在当前浏览器里，不会写进项目文件。

## 本版新增

- **单文件存档**：检索结果、设定圣经、体检报告、修补结果、冒险进度全部写进一个 `<小说名>.json`，保存在 `backend/data/projects/`，随时可续玩。
- **导入 JSON**：首页可直接导入项目存档、设定圣经或检索结果，跳过前面的步骤。
- **导出 JSON**：每个阶段右上角都能导出当前项目，方便备份或换机器继续。
- **自动修补**：体检完成后自动把修补方案回填进设定圣经，后续冒险使用补全后的世界设定。
- **冒险回退**：每次选择都会留一个快照，点「回退」可以退回上一次选择之前，读档后回退记录仍然有效。
- **本机存档列表**：首页会列出最近的存档，点一下就能继续。

## 存档

- 位置：`backend/data/projects/<id>.json`，一个项目一个文件，UTF-8、带缩进，可直接阅读和手工编辑。
- 自动保存：检索完成、生成圣经、体检/修补、每次冒险选择后都会自动保存（约 0.6 秒防抖）。
- 目录可改：在 `backend/.env` 里设置 `PROJECT_DATA_DIR=/your/path`。
- 导入兼容三种结构：
  - 项目存档（含 `search` / `bible` / `check` / `repair` / `adventure`）
  - 设定圣经（含 `worldview` / `characters` / `factions` 等）
  - 检索结果（含 `results`）
- 导入同名存档会覆盖 `backend/data/projects/` 里的同名文件，导入前可先导出备份。

## 常用参数

```bash
python start.py --port 8000       # 换端口
python start.py --host 0.0.0.0    # 允许局域网访问（注意安全）
python start.py --no-browser      # 不自动打开浏览器
python start.py --rebuild         # 重新构建前端（需要 Node 20.9+ / pnpm 9+）
```

## 遇到问题

| 现象 | 处理 |
|---|---|
| 提示需要 Python 3.12+ | 升级 Python，Windows 建议用 python.org 安装包 |
| 端口被占用 | `python start.py --port 8001` |
| 页面 404 / 空白 | `python start.py --rebuild`（需 Node + pnpm） |
| AI 报 401 / 403 | Key 不对或没权限，重新填写并测试连接 |
| AI 报 404 | 检查 Base URL（通常以 `/v1` 结尾）和模型名 |
| 提示「保存失败」 | 检查 `backend/data/` 是否有写权限，或换 `PROJECT_DATA_DIR` |
| 导入提示「无法识别的 JSON」 | 只支持本项目的项目存档 / 设定圣经 / 检索结果三种结构 |
| 想恢复默认 | 删除 `backend/.env`，并在页面点「清除配置」 |

## 它包含什么

- **小说检索**：获取作者、状态、世界观等公开资料；未配置检索时由模型知识兜底。
- **设定圣经**：世界观、力量体系、势力、人物、时间线、悬念线索。
- **设定体检**：整体评分、逻辑漏洞、可直接采用的修复建议。
- **设定修补**：按体检报告改写圣经，补全缺失内容，再进入冒险。
- **文字冒险**：选角色或自定义身份，在场景中做选择，生命/战力/声望随之变化；支持回退。
- **项目存档**：单文件 JSON、自动保存、导入导出、本机存档列表。
- **多服务商**：OpenAI、DeepSeek、Ollama、火山方舟、阿里百炼、硅基流动、Moonshot、智谱。

## 隐私

- 不需要注册，不收集数据；AI 配置只存在本机浏览器 `localStorage`，随请求发给本机后端。
- 项目存档只写在本机磁盘，不会上传。
- 仓库不包含 `.env`、API Key、虚拟环境、依赖目录或本地存档。
- 默认只监听 `127.0.0.1`；只有你填写的 AI 服务会收到请求。
- 共用电脑请离开前点「清除配置」。

## 开发者

| 目录 | 说明 |
|---|---|
| `projects/` | Next.js 16 + React 19 + Tailwind 4，静态导出 |
| `backend/` | FastAPI，托管静态页面并提供 `/api/*` |
| `backend/app/store.py` | 项目存档的本地文件读写（原子写入、路径校验） |
| `backend/app/ai/prompts/` | 各阶段提示词，含 `repair.py` 设定修补 |
| `backend/tests/` | pytest 契约测试与 prompt 快照 |
| `backend/data/projects/` | 运行时生成的项目存档（已 gitignore） |
| `start.py` | 跨平台一键启动脚本 |

主要接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/search` | 检索小说资料 |
| POST | `/api/bible` | 生成设定圣经（SSE） |
| POST | `/api/check` | 漏洞体检（SSE） |
| POST | `/api/repair` | 按体检结果修补圣经（SSE） |
| POST | `/api/game` | 生成冒险开场（SSE） |
| POST | `/api/game/action` | 推进一个场景（SSE） |
| GET | `/api/projects` | 列出本机存档 |
| GET/PUT/DELETE | `/api/projects/{id}` | 读取 / 保存 / 删除存档 |
| GET | `/api/meta` | 版本与存档格式信息 |

```bash
# 后端测试
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt   # macOS/Linux: .venv/bin/pip
.venv/Scripts/python -m pytest -q

# 前端检查 / 开发
cd projects
pnpm install
pnpm validate
pnpm dev        # http://127.0.0.1:3000，/api 代理到 8000
```

接口文档在服务启动后访问 `/docs`。更多编码约定见 `projects/AGENTS.md`，视觉规范见 `projects/DESIGN.md`。
