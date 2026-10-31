#!/usr/bin/env python3
"""假如是你 · 一键启动脚本（只需要 Python 3.12+）。"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "projects"
STATIC = BACKEND / "app" / "static"
VENV = BACKEND / ".venv"


def info(message: str) -> None:
    print(f"==> {message}", flush=True)


def configure_output() -> None:
    """重定向到文件/管道时使用 UTF-8；真实终端保持系统编码。"""
    for stream in (sys.stdout, sys.stderr):
        if not stream.isatty():
            try:
                stream.reconfigure(encoding="utf-8")
            except (AttributeError, OSError):
                pass


def fail(message: str) -> None:
    print(f"\n[错误] {message}", file=sys.stderr, flush=True)
    raise SystemExit(1)


def venv_python() -> Path:
    return VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def run(command: list[object], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run([str(part) for part in command], cwd=cwd)


def ensure_venv() -> Path:
    python = venv_python()
    if python.exists():
        return python

    info("创建 Python 虚拟环境（首次运行，只需一次）")
    result = run([sys.executable, "-m", "venv", VENV])
    if result.returncode != 0 or not python.exists():
        fail("创建虚拟环境失败。请确认 Python 安装完整，或手动执行：python -m venv backend/.venv")
    return python


def ensure_deps(python: Path) -> None:
    check = subprocess.run(
        [str(python), "-c", "import fastapi, uvicorn, openai, httpx, dotenv"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if check.returncode == 0:
        return

    info("安装后端依赖（首次运行需要联网，约 1 分钟）")
    result = run([python, "-m", "pip", "install", "-r", BACKEND / "requirements.txt"])
    if result.returncode != 0:
        fail("后端依赖安装失败，请检查网络后重试。")


def ensure_env() -> None:
    env_file = BACKEND / ".env"
    if env_file.exists():
        return
    example = BACKEND / ".env.example"
    if not example.exists():
        fail("缺少 backend/.env.example，请重新下载完整项目。")
    shutil.copyfile(example, env_file)
    info("已生成 backend/.env（可以留空，稍后在网页里配置 AI）")


def pnpm_command() -> list[str]:
    pnpm = shutil.which("pnpm") or shutil.which("pnpm.cmd")
    if not pnpm:
        fail("前端页面缺失，且未找到 pnpm。请安装 Node.js 20.9+ 与 pnpm 9+，或重新下载完整项目。")
    # Windows 下 pnpm 是 .cmd，需要经由 cmd.exe 执行。
    if os.name == "nt" and pnpm.lower().endswith((".cmd", ".bat")):
        return ["cmd", "/c", pnpm]
    return [pnpm]


def build_static() -> None:
    pnpm = pnpm_command()

    if not (FRONTEND / "node_modules").exists():
        info("安装前端依赖（仅构建前端时需要，约 1 分钟）")
        if run(pnpm + ["install"], cwd=FRONTEND).returncode != 0:
            fail("前端依赖安装失败，请检查网络后重试。")

    info("构建前端页面")
    os.environ["NEXT_TELEMETRY_DISABLED"] = "1"
    if run(pnpm + ["build"], cwd=FRONTEND).returncode != 0:
        fail("前端构建失败，请查看上面的日志。")

    out = FRONTEND / "out"
    if not (out / "index.html").exists():
        fail("没有找到构建产物 projects/out/index.html。")

    info("同步静态页面到后端")
    STATIC.mkdir(parents=True, exist_ok=True)
    for item in STATIC.iterdir():
        if item.name == ".gitkeep":
            continue
        if item.is_dir():
            shutil.rmtree(item)
        else:
            item.unlink()
    shutil.copytree(out, STATIC, dirs_exist_ok=True)


def ensure_static(rebuild: bool) -> None:
    if rebuild or not (STATIC / "index.html").exists():
        build_static()


def app_version() -> str:
    """从 backend/app/version.py 读取版本号，避免多处硬编码。"""
    version_file = BACKEND / "app" / "version.py"
    try:
        match = re.search(
            r'^APP_VERSION\s*=\s*"([^"]+)"',
            version_file.read_text(encoding="utf-8"),
            re.MULTILINE,
        )
    except OSError:
        return ""
    return match.group(1) if match else ""


def open_browser_later(url: str, host: str) -> None:
    if host not in {"127.0.0.1", "localhost", "0.0.0.0"}:
        return

    def opener() -> None:
        time.sleep(1.5)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Thread(target=opener, daemon=True).start()


def main() -> int:
    parser = argparse.ArgumentParser(description="假如是你 · 一键启动")
    parser.add_argument("--port", type=int, default=5000, help="监听端口，默认 5000")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址，默认 127.0.0.1")
    parser.add_argument("--rebuild", action="store_true", help="强制重新构建前端")
    parser.add_argument("--no-browser", action="store_true", help="不自动打开浏览器")
    args = parser.parse_args()

    if not (BACKEND / "app" / "main.py").exists():
        fail("找不到 backend/app/main.py，请确认项目文件完整。")
    if sys.version_info < (3, 12):
        fail(f"需要 Python 3.12 或更高版本，当前是 {sys.version.split()[0]}。")
    if not 1 <= args.port <= 65535:
        fail("端口必须在 1 到 65535 之间。")

    python = ensure_venv()
    ensure_deps(python)
    ensure_env()
    ensure_static(args.rebuild)

    display_host = "127.0.0.1" if args.host == "0.0.0.0" else args.host
    url = f"http://{display_host}:{args.port}"

    version = app_version()
    print()
    print("=" * 52)
    print(f"  假如是你{' v' + version if version else ''} 已就绪：{url}")
    print("  第一次使用：点右上角齿轮，填 AI 地址和 Key")
    print("  存档目录：backend/data/projects（每个项目一个 JSON）")
    print("  按 Ctrl+C 停止服务")
    print("=" * 52)
    print(flush=True)

    if not args.no_browser:
        open_browser_later(url, args.host)

    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    try:
        return subprocess.run(
            [
                str(python),
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                args.host,
                "--port",
                str(args.port),
            ],
            cwd=BACKEND,
            env=env,
        ).returncode
    except KeyboardInterrupt:
        print("\n已停止。")
        return 0


if __name__ == "__main__":
    configure_output()
    sys.exit(main())
