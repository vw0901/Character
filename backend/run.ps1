param(
    [int]$Port = 5000,
    [string]$HostAddr = "127.0.0.1",
    [switch]$Reload
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$env:PYTHONUTF8 = "1"

$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$python = if (Test-Path $venvPython) { $venvPython } else { "python" }
$uvicornArgs = @("-m", "uvicorn", "app.main:app", "--host", $HostAddr, "--port", "$Port")
if ($Reload) { $uvicornArgs += "--reload" }

& $python @uvicornArgs
exit $LASTEXITCODE
