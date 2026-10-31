async function responseError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (payload && typeof payload.error === 'string') {
      return payload.error;
    }
  } catch {
    // Ignore non-JSON error bodies.
  }
  return `请求失败（HTTP ${response.status}）`;
}

export async function* readSseText(response: Response): AsyncGenerator<string> {
  if (!response.ok) {
    throw new Error(await responseError(response));
  }
  if (!response.body) {
    throw new Error('AI 服务未返回响应内容');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';

      for (const event of events) {
        for (const line of event.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;

          let payload: unknown;
          try {
            payload = JSON.parse(raw);
          } catch {
            continue;
          }
          if (!payload || typeof payload !== 'object') continue;

          const data = payload as { text?: unknown; error?: unknown };
          if (typeof data.error === 'string' && data.error) {
            throw new Error(data.error);
          }
          if (typeof data.text === 'string' && data.text) {
            yield data.text;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
