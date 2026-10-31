#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")"
export PYTHONUTF8=1

if [ -x ".venv/Scripts/python.exe" ]; then
  PYTHON_BIN=".venv/Scripts/python.exe"
elif [ -x ".venv/bin/python" ]; then
  PYTHON_BIN=".venv/bin/python"
else
  PYTHON_BIN="${PYTHON_BIN:-python}"
fi

HOST_ADDR="${HOST:-127.0.0.1}"
PORT="${PORT:-5000}"
ARGS=(-m uvicorn app.main:app --host "$HOST_ADDR" --port "$PORT")
if [ "${RELOAD:-0}" = "1" ]; then
  ARGS+=(--reload)
fi

exec "$PYTHON_BIN" "${ARGS[@]}"
