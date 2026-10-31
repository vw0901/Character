import os
import shutil
import socket
import threading
import time
import uuid
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest
import uvicorn
from fastapi.testclient import TestClient

from app.main import app
from mock_openai_server import app as mock_app


class MockServer(uvicorn.Server):
    def install_signal_handlers(self) -> None:
        pass


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.fixture(scope="session")
def mock_server() -> str:
    port = _free_port()
    config = uvicorn.Config(
        mock_app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
    )
    server = MockServer(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    base_url = f"http://127.0.0.1:{port}"
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            response = httpx.get(f"{base_url}/healthz", timeout=0.5)
            if response.status_code == 200:
                break
        except httpx.HTTPError:
            pass
        time.sleep(0.05)
    else:
        server.should_exit = True
        thread.join(timeout=3)
        raise RuntimeError("mock OpenAI server did not start")

    yield f"{base_url}/v1"

    server.should_exit = True
    thread.join(timeout=5)


@pytest.fixture(autouse=True)
def ai_env(monkeypatch: pytest.MonkeyPatch, mock_server: str) -> None:
    monkeypatch.setenv("OPENAI_BASE_URL", mock_server)
    monkeypatch.setenv("OPENAI_API_KEY", "mock-key")
    monkeypatch.setenv("OPENAI_MODEL", "mock-chat")
    monkeypatch.setenv("AI_SEARCH_PROVIDER", "none")
    monkeypatch.setenv("TAVILY_API_KEY", "")
    for name in ("AI_BASE_URL", "AI_API_KEY", "AI_MODEL"):
        monkeypatch.setenv(name, "")


@pytest.fixture(scope="session", autouse=True)
def cleanup_project_tmp() -> Iterator[None]:
    """测试结束后清掉临时存档根目录，避免在仓库里留下垃圾。"""
    yield
    if os.getenv("PROJECT_TEST_TMP"):
        return
    shutil.rmtree(Path(__file__).resolve().parent.parent / "tmp-test-data", ignore_errors=True)


@pytest.fixture(autouse=True)
def project_data_dir(monkeypatch: pytest.MonkeyPatch) -> Path:
    """每个测试一个独立的存档目录。

    这里刻意不用 pytest 的 tmp_path：它创建目录时带 0o700 权限，
    在部分受限环境（如 Windows 沙箱）下会变成无法访问的目录。
    """
    base = Path(os.getenv("PROJECT_TEST_TMP") or (Path(__file__).resolve().parent.parent / "tmp-test-data"))
    base.mkdir(parents=True, exist_ok=True)
    directory = base / uuid.uuid4().hex
    directory.mkdir()
    monkeypatch.setenv("PROJECT_DATA_DIR", str(directory))
    yield directory
    shutil.rmtree(directory, ignore_errors=True)


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client
