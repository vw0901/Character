[CmdletBinding()]
param(
    [int]$Port = 5000,
    [string]$HostAddr = "127.0.0.1",
    [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "projects"
$staticDir = Join-Path $backendDir "app\static"

function Write-Step([string]$Message) {
    Write-Host "==> $Message" -ForegroundColor Cyan
}

if (-not (Test-Path (Join-Path $backendDir "app\main.py"))) {
    throw "未找到 backend/app/main.py，请在项目根目录运行此脚本。"
}

# 1. Python 虚拟环境
$venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Step "创建 Python 虚拟环境"
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCommand) {
        throw "未找到 Python，请先安装 Python 3.12+ 并加入 PATH。"
    }
    & python -m venv (Join-Path $backendDir ".venv")
    if ($LASTEXITCODE -ne 0) {
        throw "创建虚拟环境失败。"
    }
}

# 2. 后端依赖（已安装则跳过）
& $venvPython -c "import fastapi, uvicorn, openai, httpx, dotenv" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Step "安装后端依赖"
    & $venvPython -m pip install -r (Join-Path $backendDir "requirements.txt")
    if ($LASTEXITCODE -ne 0) {
        throw "后端依赖安装失败。"
    }
}

# 3. 环境变量文件
$envFile = Join-Path $backendDir ".env"
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $backendDir ".env.example") $envFile
    Write-Step "已生成 backend/.env（可留空，推荐在页面「AI 设置」中配置）"
}

# 4. 前端静态产物
$indexFile = Join-Path $staticDir "index.html"
if ($Rebuild -or -not (Test-Path $indexFile)) {
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        throw "构建前端需要 Node.js 20.9+ 与 pnpm 9+；也可以把已构建的 out 目录同步到 backend/app/static。"
    }

    if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
        Write-Step "安装前端依赖"
        Push-Location $frontendDir
        try {
            & pnpm install
            if ($LASTEXITCODE -ne 0) { throw "前端依赖安装失败。" }
        }
        finally {
            Pop-Location
        }
    }

    Write-Step "构建前端静态文件"
    Push-Location $frontendDir
    try {
        & pnpm build
        if ($LASTEXITCODE -ne 0) { throw "前端构建失败。" }
    }
    finally {
        Pop-Location
    }

    $outDir = Join-Path $frontendDir "out"
    if (-not (Test-Path (Join-Path $outDir "index.html"))) {
        throw "未找到前端构建产物 projects/out/index.html。"
    }

    Write-Step "同步静态文件到 backend/app/static"
    if (-not (Test-Path $staticDir)) {
        New-Item -ItemType Directory -Path $staticDir | Out-Null
    }
    Get-ChildItem $staticDir -Force |
        Where-Object { $_.Name -ne ".gitkeep" } |
        Remove-Item -Recurse -Force
    Copy-Item (Join-Path $outDir "*") $staticDir -Recurse -Force
}

# 5. 启动服务
$displayHost = if ($HostAddr -eq "0.0.0.0") { "127.0.0.1" } else { $HostAddr }
Write-Host ""
Write-Host "角色圣经已就绪：http://${displayHost}:$Port" -ForegroundColor Green
Write-Host "按 Ctrl+C 停止服务。" -ForegroundColor DarkGray
Write-Host ""

$env:PYTHONUTF8 = "1"
Push-Location $backendDir
try {
    & $venvPython -m uvicorn app.main:app --host $HostAddr --port $Port
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}
exit $exitCode
