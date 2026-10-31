export type SearchProvider = 'none' | 'tavily';

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  searchProvider: SearchProvider;
  tavilyApiKey: string;
}

export interface AiPreset {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export const AI_PRESETS: AiPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: '官方 OpenAI 兼容接口',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek 开放平台',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: '本地模型，API Key 可留空',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5:14b',
    apiKey: 'ollama',
  },
  {
    id: 'ark',
    name: '火山方舟',
    description: '需要填写推理接入点 ID 作为模型',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: '',
  },
  {
    id: 'dashscope',
    name: '阿里百炼',
    description: '通义千问兼容模式',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    description: 'SiliconCloud 模型广场',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-7B-Instruct',
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    description: 'Kimi 开放平台',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  {
    id: 'zhipu',
    name: '智谱',
    description: 'GLM 开放平台',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
  },
];

export const DEFAULT_PRESET_ID = 'openai';

export function emptyAiConfig(): AiConfig {
  return {
    baseUrl: '',
    apiKey: '',
    model: '',
    searchProvider: 'none',
    tavilyApiKey: '',
  };
}
