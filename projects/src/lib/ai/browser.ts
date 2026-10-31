import type { AiConfig, SearchProvider } from './config';

const STORAGE_KEY = 'novel-ai-config-v1';

function normalize(raw: unknown): AiConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const baseUrl = typeof value.baseUrl === 'string' ? value.baseUrl.trim() : '';
  const model = typeof value.model === 'string' ? value.model.trim() : '';
  if (!baseUrl || !model) return null;

  const searchProvider: SearchProvider =
    value.searchProvider === 'tavily' ? 'tavily' : 'none';

  return {
    baseUrl,
    model,
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
    searchProvider,
    tavilyApiKey:
      typeof value.tavilyApiKey === 'string' ? value.tavilyApiKey : '',
  };
}

export function readAiConfig(): AiConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeAiConfig(config: AiConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearAiConfig(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function withAiConfig<T extends object>(
  payload: T
): T & { aiConfig?: AiConfig } {
  const config = readAiConfig();
  return config ? { ...payload, aiConfig: config } : payload;
}
