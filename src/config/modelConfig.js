// 模型配置文件
export const modelProviders = [
  {
    id: 'qwen',
    name: '通义千问 (Qwen)',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen-max', name: 'Qwen-Max', description: '通义千问最强大的大语言模型' },
      { id: 'qwen3-235b-a22b', name: 'Qwen3-235B-A22B', description: '通义千问最新大模型，支持思考模式' },
      { id: 'qwen-max-longcontext', name: 'Qwen-Max-LongContext', description: '支持更长上下文的大语言模型' },
      { id: 'qwen-vl-max', name: 'Qwen-VL-Max', description: '支持视觉理解的多模态大模型' },
      { id: 'qwq-plus', name: 'QwQ-Plus', description: '通义千问思考模式专用模型' }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    base_url: 'https://api.deepseek.com',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '通用对话大模型' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: '专注于推理能力的大模型' }
    ]
  },
  {
    id: 'baichuan',
    name: '百川 (Baichuan)',
    base_url: 'https://api.baichuan-ai.com/v1',
    models: [
      { id: 'baichuan-turbo', name: 'Baichuan Turbo', description: '百川AI的高性能对话模型' }
    ]
  },
  {
    id: 'chatglm',
    name: '智谱 (ChatGLM)',
    base_url: 'https://open.bigmodel.cn/api/paas/v3',
    models: [
      { id: 'chatglm-turbo', name: 'ChatGLM Turbo', description: '智谱AI的高性能对话模型' }
    ]
  }
];

// 获取所有模型选项（扁平化列表，用于兼容旧版本）
export const getAllModelOptions = () => {
  const options = [];

  modelProviders.forEach(provider => {
    // 添加厂商作为顶级选项
    options.push({
      value: provider.id,
      label: provider.name,
      isProvider: true
    });

    // 添加该厂商下的所有模型
    provider.models.forEach(model => {
      options.push({
        value: `${provider.id}:${model.id}`,
        label: model.name,
        providerId: provider.id,
        description: model.description
      });
    });
  });

  return options;
};

// 根据模型ID获取模型信息
export const getModelInfo = (modelId) => {
  if (!modelId) return null;

  // 如果是复合ID (provider:model)
  if (modelId.includes(':')) {
    const [providerId, modelId] = modelId.split(':');
    const provider = modelProviders.find(p => p.id === providerId);
    if (!provider) return null;

    const model = provider.models.find(m => m.id === modelId);
    if (!model) return null;

    return {
      ...model,
      provider: provider.name,
      providerId: provider.id,
      base_url: provider.base_url
    };
  }

  // 如果只是厂商ID
  const provider = modelProviders.find(p => p.id === modelId);
  if (!provider) return null;

  // 返回厂商的默认模型
  const defaultModel = provider.models[0];
  return {
    ...defaultModel,
    provider: provider.name,
    providerId: provider.id,
    base_url: provider.base_url
  };
};

// 获取厂商信息
export const getProviderInfo = (providerId) => {
  return modelProviders.find(p => p.id === providerId);
};

// 获取厂商的所有模型
export const getProviderModels = (providerId) => {
  const provider = modelProviders.find(p => p.id === providerId);
  return provider ? provider.models : [];
};
