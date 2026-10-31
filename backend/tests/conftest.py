import socket
import threading
import time

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


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client
