'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  Trash2,
} from 'lucide-react';

import { clearAiConfig, readAiConfig, writeAiConfig } from '@/lib/ai/browser';
import {
  AI_PRESETS,
  DEFAULT_PRESET_ID,
  emptyAiConfig,
  type AiConfig,
  type AiPreset,
  type SearchProvider,
} from '@/lib/ai/config';

type Notice = {
  kind: 'success' | 'error' | 'info';
  text: string;
};

const inputClass =
  'w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-parchment placeholder:text-muted-foreground/50 focus:border-amber/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const labelClass = 'mb-1.5 block text-sm text-parchment';

function initialForm(): AiConfig {
  const preset = AI_PRESETS.find((item) => item.id === DEFAULT_PRESET_ID);
  return {
    ...emptyAiConfig(),
    baseUrl: preset?.baseUrl ?? '',
    model: preset?.model ?? '',
    apiKey: preset?.apiKey ?? '',
  };
}

export default function SettingsPage() {
  const [form, setForm] = useState<AiConfig>(initialForm);
  const [selectedPreset, setSelectedPreset] = useState(DEFAULT_PRESET_ID);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<'models' | 'test' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const saved = readAiConfig();
    if (!saved) return;
    const matching = AI_PRESETS.find(
      (preset) => preset.baseUrl === saved.baseUrl && preset.model === saved.model
    );
    setForm(saved);
    setSelectedPreset(matching?.id ?? 'custom');
  }, []);

  const applyPreset = (preset: AiPreset) => {
    setSelectedPreset(preset.id);
    setModels([]);
    setNotice(null);
    setForm((previous) => ({
      ...previous,
      baseUrl: preset.baseUrl,
      model: preset.model,
      apiKey: preset.apiKey ?? '',
    }));
  };

  const update = <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (key === 'baseUrl' || key === 'model') {
      setSelectedPreset('custom');
    }
  };

  const currentConfig = (): AiConfig => ({
    ...form,
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKey.trim(),
    model: form.model.trim(),
    tavilyApiKey: form.tavilyApiKey.trim(),
  });

  const validate = (): string | null => {
    const config = currentConfig();
    if (!config.baseUrl) return '请填写 Base URL';
    if (!config.model) return '请填写模型名称';
    return null;
  };

  const requestConfig = async (path: string, body: object) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload && typeof payload.error === 'string'
          ? payload.error
          : '请求失败，请检查后端服务是否已启动';
      throw new Error(message);
    }
    return payload;
  };

  const handleFetchModels = async () => {
    const validationError = validate();
    if (validationError) {
      setNotice({ kind: 'error', text: validationError });
      return;
    }
    setBusy('models');
    setNotice(null);
    try {
      const payload = await requestConfig('/api/models', {
        aiConfig: currentConfig(),
      });
      const list = Array.isArray(payload?.models)
        ? payload.models.filter((item: unknown): item is string => typeof item === 'string')
        : [];
      setModels(list);
      setNotice({
        kind: 'success',
        text: list.length ? `已获取 ${list.length} 个模型` : '连接成功，但服务未返回模型列表',
      });
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : '获取模型列表失败',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    const validationError = validate();
    if (validationError) {
      setNotice({ kind: 'error', text: validationError });
      return;
    }
    setBusy('test');
    setNotice(null);
    const startedAt = Date.now();
    try {
      const payload = await requestConfig('/api/ai/test', {
        aiConfig: currentConfig(),
      });
      const elapsed = Date.now() - startedAt;
      const reply =
        payload && typeof payload.reply === 'string' && payload.reply
          ? `，模型回复：${payload.reply}`
          : '';
      setNotice({
        kind: 'success',
        text: `连接成功（${elapsed} ms）${reply}`,
      });
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'AI 连接测试失败',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleSave = () => {
    const validationError = validate();
    if (validationError) {
      setNotice({ kind: 'error', text: validationError });
      return;
    }
    writeAiConfig(currentConfig());
    setNotice({ kind: 'success', text: '设置已保存到当前浏览器' });
  };

  const handleClear = () => {
    clearAiConfig();
    setForm(emptyAiConfig());
    setSelectedPreset('custom');
    setModels([]);
    setNotice({ kind: 'info', text: '已清除浏览器中的 AI 配置' });
  };

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Settings className="h-7 w-7 text-amber" />
            <div>
              <h1 className="font-serif text-2xl font-bold text-parchment">AI 设置</h1>
              <p className="text-xs text-muted-foreground">
                配置 OpenAI 兼容服务，设置只保存在当前浏览器的 localStorage
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-amber/30 hover:text-parchment"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
        </div>

        <section className="mb-6 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 font-serif text-lg text-parchment">服务商预设</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            选择预设后仍可手动修改下面的连接参数
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {AI_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  selectedPreset === preset.id
                    ? 'border-amber/60 bg-amber/10'
                    : 'border-border bg-secondary/40 hover:border-amber/30'
                }`}
              >
                <span className="block text-sm font-medium text-parchment">{preset.name}</span>
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6 space-y-5 rounded-xl border border-border bg-card p-5">
          <div>
            <label htmlFor="base-url" className={labelClass}>
              Base URL <span className="text-crimson">*</span>
            </label>
            <input
              id="base-url"
              value={form.baseUrl}
              onChange={(event) => update('baseUrl', event.target.value)}
              placeholder="例如：http://127.0.0.1:11434/v1"
              className={inputClass}
              autoComplete="url"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              需指向 OpenAI 兼容接口的版本根路径；缺少 /v1 时后端会自动补全。
            </p>
          </div>

          <div>
            <label htmlFor="api-key" className={labelClass}>
              API Key
            </label>
            <input
              id="api-key"
              type="password"
              value={form.apiKey}
              onChange={(event) => update('apiKey', event.target.value)}
              placeholder="本地模型可留空"
              className={inputClass}
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="model" className={labelClass}>
              模型名称 <span className="text-crimson">*</span>
            </label>
            <input
              id="model"
              list="model-options"
              value={form.model}
              onChange={(event) => update('model', event.target.value)}
              placeholder="例如：qwen2.5:14b"
              className={inputClass}
              autoComplete="off"
            />
            <datalist id="model-options">
              {models.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="search-provider" className={labelClass}>
                联网检索
              </label>
              <select
                id="search-provider"
                value={form.searchProvider}
                onChange={(event) =>
                  update('searchProvider', event.target.value as SearchProvider)
                }
                className={inputClass}
              >
                <option value="none">不启用（由模型知识兜底）</option>
                <option value="tavily">Tavily</option>
              </select>
            </div>
            {form.searchProvider === 'tavily' && (
              <div>
                <label htmlFor="tavily-key" className={labelClass}>
                  Tavily API Key
                </label>
                <input
                  id="tavily-key"
                  type="password"
                  value={form.tavilyApiKey}
                  onChange={(event) => update('tavilyApiKey', event.target.value)}
                  placeholder="tvly-..."
                  className={inputClass}
                  autoComplete="off"
                />
              </div>
            )}
          </div>
        </section>

        {notice && (
          <div
            className={`mb-6 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
              notice.kind === 'success'
                ? 'border-forest/30 bg-forest/10 text-forest'
                : notice.kind === 'error'
                  ? 'border-crimson/30 bg-crimson/10 text-crimson'
                  : 'border-border bg-secondary text-muted-foreground'
            }`}
          >
            {notice.kind === 'error' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="break-all">{notice.text}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleFetchModels}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-parchment transition-colors hover:border-amber/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'models' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            获取模型
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-parchment transition-colors hover:border-amber/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'test' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            测试连接
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-amber px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-amber-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            保存设置
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-crimson/30 px-4 py-2.5 text-sm text-crimson transition-colors hover:bg-crimson/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            清除配置
          </button>
        </div>

        <p className="mt-6 rounded-lg border border-border bg-secondary/40 p-4 text-xs leading-relaxed text-muted-foreground">
          浏览器配置会随每次 API 请求发送；若未保存任何配置，后端会回退读取
          <code className="mx-1 text-amber">backend/.env</code>
          中的 OPENAI_BASE_URL、OPENAI_API_KEY 与 OPENAI_MODEL。
        </p>
      </div>
    </main>
  );
}
