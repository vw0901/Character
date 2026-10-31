#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/projects"
STATIC="$BACKEND/app/static"
PORT=5000
HOST="127.0.0.1"
REBUILD=0

usage() {
  cat <<'EOF'
用法: ./start.sh [选项]

  --port <端口>    监听端口（默认 5000）
  --host <地址>    监听地址（默认 127.0.0.1）
  --rebuild        强制重新构建前端
  -h, --help       显示帮助
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="${2:?缺少端口值}"; shift 2 ;;
    --host) HOST="${2:?缺少地址值}"; shift 2 ;;
    --rebuild) REBUILD=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数: $1" >&2; usage; exit 1 ;;
  esac
done

step() { printf '\033[36m==> %s\033[0m\n' "$1"; }

[[ -f "$BACKEND/app/main.py" ]] || { echo "未找到 backend/app/main.py，请在项目根目录运行。" >&2; exit 1; }

# 1. Python 虚拟环境
PYTHON="$BACKEND/.venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then
  step "创建 Python 虚拟环境"
  if command -v python3 >/dev/null 2>&1; then
    python3 -m venv "$BACKEND/.venv"
  elif command -v python >/dev/null 2>&1; then
    python -m venv "$BACKEND/.venv"
  else
    echo "未找到 Python，请先安装 Python 3.12+。" >&2
    exit 1
  fi
  PYTHON="$BACKEND/.venv/bin/python"
fi

# 2. 后端依赖（已安装则跳过）
if ! "$PYTHON" -c "import fastapi, uvicorn, openai, httpx, dotenv" >/dev/null 2>&1; then
  step "安装后端依赖"
  "$PYTHON" -m pip install -r "$BACKEND/requirements.txt"
fi

# 3. 环境变量文件
if [[ ! -f "$BACKEND/.env" ]]; then
  cp "$BACKEND/.env.example" "$BACKEND/.env"
  step "已生成 backend/.env（可留空，推荐在页面「AI 设置」中配置）"
fi

# 4. 前端静态产物
if [[ "$REBUILD" -eq 1 || ! -f "$STATIC/index.html" ]]; then
  command -v pnpm >/dev/null 2>&1 || {
    echo "构建前端需要 Node.js 20.9+ 与 pnpm 9+；也可以把已构建的 out 目录同步到 backend/app/static。" >&2
    exit 1
  }

  if [[ ! -d "$FRONTEND/node_modules" ]]; then
    step "安装前端依赖"
    (cd "$FRONTEND" && pnpm install)
  fi

  step "构建前端静态文件"
  (cd "$FRONTEND" && pnpm build)

  [[ -f "$FRONTEND/out/index.html" ]] || { echo "未找到前端构建产物 projects/out/index.html。" >&2; exit 1; }

  step "同步静态文件到 backend/app/static"
  mkdir -p "$STATIC"
  find "$STATIC" -mindepth 1 -maxdepth 1 ! -name '.gitkeep' -exec rm -rf {} +
  cp -a "$FRONTEND/out/." "$STATIC/"
fi

# 5. 启动服务
DISPLAY_HOST="$HOST"
[[ "$HOST" == "0.0.0.0" ]] && DISPLAY_HOST="127.0.0.1"

printf '\n\033[32m角色圣经已就绪：http://%s:%s\033[0m\n' "$DISPLAY_HOST" "$PORT"
printf '按 Ctrl+C 停止服务。\n\n'

export PYTHONUTF8=1
cd "$BACKEND"
exec "$PYTHON" -m uvicorn app.main:app --host "$HOST" --port "$PORT"
