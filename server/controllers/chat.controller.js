const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { saveBase64Image, getImageUrl } = require('../utils/imageProcessor');

// 获取用户的所有对话
exports.getConversations = async (req, res) => {
  try {
    const conversationModel = new Conversation(req.db);
    const conversations = await conversationModel.getByUserId(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        conversations
      }
    });
  } catch (error) {
    console.error('获取对话列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取对话列表失败',
      error: error.message
    });
  }
};

// 创建新对话
exports.createConversation = async (req, res) => {
  try {
    const { title, model_name } = req.body;

    if (!model_name) {
      return res.status(400).json({
        success: false,
        message: '请提供模型名称'
      });
    }

    const conversationModel = new Conversation(req.db);
    const conversation = await conversationModel.create(
      req.user.id,
      title || '新对话',
      model_name
    );

    res.status(201).json({
      success: true,
      data: {
        conversation
      }
    });
  } catch (error) {
    console.error('创建对话错误:', error);
    res.status(500).json({
      success: false,
      message: '创建对话失败',
      error: error.message
    });
  }
};

// 获取特定对话及其消息
exports.getConversation = async (req, res) => {
  try {
    const { id } = req.params;

    const conversationModel = new Conversation(req.db);
    const messageModel = new Message(req.db);

    const conversation = await conversationModel.getById(id, req.user.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: '对话不存在或无权访问'
      });
    }

    const messages = await messageModel.getByConversationId(id);

    res.status(200).json({
      success: true,
      data: {
        conversation,
        messages
      }
    });
  } catch (error) {
    console.error('获取对话详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取对话详情失败',
      error: error.message
    });
  }
};

// 更新对话标题或模型
exports.updateConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, model_name } = req.body;

    console.log('收到更新对话请求:', { id, title, model_name });

    if (!title && !model_name) {
      console.log('缺少必要参数');
      return res.status(400).json({
        success: false,
        message: '请提供对话标题或模型名称'
      });
    }

    const conversationModel = new Conversation(req.db);
    let success = false;

    if (title) {
      console.log('更新对话标题:', title);
      success = await conversationModel.updateTitle(id, req.user.id, title);
    }

    if (model_name) {
      console.log('更新对话模型:', model_name);
      success = await conversationModel.updateModel(id, req.user.id, model_name);
      console.log('更新模型结果:', success ? '成功' : '失败');
    }

    if (!success) {
      console.log('对话不存在或无权访问');
      return res.status(404).json({
        success: false,
        message: '对话不存在或无权访问'
      });
    }

    console.log('更新对话成功');
    res.status(200).json({
      success: true,
      message: title ? '对话标题已更新' : '对话模型已更新'
    });
  } catch (error) {
    console.error('更新对话错误:', error);
    res.status(500).json({
      success: false,
      message: '更新对话失败',
      error: error.message
    });
  }
};

// 删除对话
exports.deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;

    const conversationModel = new Conversation(req.db);
    const messageModel = new Message(req.db);

    // 先删除对话中的所有消息
    await messageModel.deleteByConversationId(id);

    // 再删除对话
    const success = await conversationModel.delete(id, req.user.id);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: '对话不存在或无权访问'
      });
    }

    res.status(200).json({
      success: true,
      message: '对话已删除'
    });
  } catch (error) {
    console.error('删除对话错误:', error);
    res.status(500).json({
      success: false,
      message: '删除对话失败',
      error: error.message
    });
  }
};

// 发送消息并获取AI回复
exports.sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, image, enable_thinking } = req.body;

    if (!message && !image) {
      return res.status(400).json({
        success: false,
        message: '请提供消息内容或图片'
      });
    }

    // 记录是否启用思考模式
    console.log('思考模式状态:', enable_thinking);

    const conversationModel = new Conversation(req.db);
    const messageModel = new Message(req.db);

    // 检查对话是否存在
    const conversation = await conversationModel.getById(id, req.user.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: '对话不存在或无权访问'
      });
    }

    // 处理图片上传
    let imagePath = null;
    let imageUrl = null;
    if (image) {
      try {
        // 保存到chat模块的images目录
        imagePath = saveBase64Image(image, 'chat', 'images');
        imageUrl = getImageUrl(imagePath);
      } catch (error) {
        console.error('保存图片错误:', error);
        return res.status(400).json({
          success: false,
          message: '图片格式无效或保存失败'
        });
      }
    }

    // 保存用户消息
    const userMessageContent = message || ''; // 如果只有图片，文本内容为空字符串
    const savedUserMessage = await messageModel.create(id, 'user', userMessageContent);

    // 如果有图片，更新消息记录添加图片URL
    if (imageUrl) {
      await req.db.execute(
        'UPDATE messages SET image_url = ? WHERE id = ?',
        [imageUrl, savedUserMessage.id]
      );
      savedUserMessage.image_url = imageUrl;
    }

    // 获取对话历史
    const messages = await messageModel.getByConversationId(id);

    // 检查是否是对话中的第一条消息
    if (messages.length === 1) {
      // 如果是第一条消息，使用用户输入的前一部分作为对话标题
      let newTitle = message.trim();

      // 限制标题长度，最多取前20个字符
      if (newTitle.length > 20) {
        newTitle = newTitle.substring(0, 20) + '...';
      }

      // 更新对话标题
      // console.log('根据用户第一条消息更新对话标题:', newTitle);
      await conversationModel.updateTitle(id, req.user.id, newTitle);
    }

    // 处理新格式的模型名称（provider:model）
    let providerId = conversation.model_name;

    if (conversation.model_name.includes(':')) {
      [providerId] = conversation.model_name.split(':');
    }

    // 获取API密钥
    const [apiKeyRows] = await req.db.execute(
      'SELECT api_key, api_base_url FROM api_keys WHERE user_id = ? AND model_name = ? AND is_active = 1',
      [req.user.id, providerId]
    );

    if (apiKeyRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: `未找到${providerId}模型的API密钥，请在API密钥管理中添加`
      });
    }

    const apiKey = apiKeyRows[0].api_key;
    const apiBaseUrl = apiKeyRows[0].api_base_url || getDefaultApiBaseUrl(providerId);

    // 准备发送给AI模型的消息历史
    const isVisualModelEnabled = isVisualModel(conversation.model_name);

    // 添加系统消息
    let messageHistory = [];

    // 如果是视觉模型，添加系统消息
    if (isVisualModelEnabled) {
      messageHistory.push({
        role: 'system',
        content: [{
          type: 'text',
          text: 'You are a helpful assistant that can understand images.'
        }]
      });
    } else {
      // 普通文本模型的系统消息
      messageHistory.push({
        role: 'system',
        content: 'You are a helpful assistant.'
      });
    }

    // 处理用户消息历史
    messages.forEach(msg => {
      // 跳过系统消息，因为我们已经添加了
      if (msg.role === 'system') return;

      let msgObj = {
        role: msg.role,
        content: msg.content
      };

      // 如果是用户消息且有图片，添加图片信息
      if (msg.role === 'user' && msg.image_url) {
        try {
          // 获取图片的完整路径
          const imagePath = msg.image_url.replace('/api/images/', 'uploads/');
          const fullPath = path.join(process.cwd(), imagePath);

          // 检查文件是否存在
          if (fs.existsSync(fullPath)) {
            // 读取图片文件并转换为Base64
            const imageBuffer = fs.readFileSync(fullPath);
            const base64Image = imageBuffer.toString('base64');

            // 获取图片MIME类型
            const mimeType = getMimeType(fullPath);

            // 构建Base64 URL
            const base64Url = `data:${mimeType};base64,${base64Image}`;

            // 对于视觉模型，需要特殊处理消息格式
            if (isVisualModelEnabled) {
              msgObj.content = [
                { type: 'text', text: msg.content },
                { type: 'image_url', image_url: { url: base64Url } }
              ];
            }
          } else {
            console.error(`图片文件不存在: ${fullPath}`);
          }
        } catch (error) {
          console.error('处理图片错误:', error);
        }
      }

      messageHistory.push(msgObj);
    });

    // 调用AI模型API
    const aiResponse = await callAiModel(conversation.model_name, messageHistory, apiKey, apiBaseUrl, enable_thinking);

    // 保存AI回复
    const savedResponse = await messageModel.create(id, 'assistant', aiResponse);

    // 更新对话时间戳
    await conversationModel.updateTimestamp(id);

    res.status(200).json({
      success: true,
      data: {
        message: savedResponse
      }
    });
  } catch (error) {
    console.error('发送消息错误:', error);
    res.status(500).json({
      success: false,
      message: '发送消息失败',
      error: error.message
    });
  }
};

// 根据模型名称获取默认API基础URL
function getDefaultApiBaseUrl(providerId) {
  const baseUrls = {
    'qwen': 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'deepseek': 'https://api.deepseek.com',
    'baichuan': 'https://api.baichuan-ai.com/v1',
    'chatglm': 'https://open.bigmodel.cn/api/paas/v3'
  };

  return baseUrls[providerId] || 'https://api.openai.com/v1';
}

// 根据文件扩展名获取MIME类型
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp'
  };

  return mimeTypes[ext] || 'image/jpeg';
}

// 检查是否是视觉模型
function isVisualModel(modelName) {
  if (!modelName) return false;

  const lowerModelName = modelName.toLowerCase();

  // 检查是否包含视觉模型关键字
  return lowerModelName.includes('vl') ||
    lowerModelName.includes('vision') ||
    lowerModelName.includes('visual') ||
    lowerModelName.includes('qwen-vl') ||
    lowerModelName.includes('vl-max') ||
    lowerModelName.includes('vl-plus') ||
    lowerModelName.includes('vl-latest');
}

// 调用不同的AI模型API
async function callAiModel(modelName, messages, apiKey, apiBaseUrl, enableThinking) {
  try {
    let response;
    let providerId = modelName;
    let modelId = null;

    // 处理新格式的模型名称（provider:model）
    if (modelName.includes(':')) {
      [providerId, modelId] = modelName.split(':');
    }

    switch (providerId) {
      case 'qwen':
        response = await exports.callQwenApi(messages, apiKey, apiBaseUrl, modelId, enableThinking);
        break;
      case 'deepseek':
        response = await callDeepseekApi(messages, apiKey, apiBaseUrl, modelId);
        break;
      case 'baichuan':
        response = await callBaichuanApi(messages, apiKey, apiBaseUrl, modelId);
        break;
      case 'chatglm':
        response = await callChatGLMApi(messages, apiKey, apiBaseUrl, modelId);
        break;
      default:
        throw new Error(`不支持的模型提供商: ${providerId}`);
    }

    return response;
  } catch (error) {
    console.error(`调用${modelName}模型API错误:`, error);
    throw new Error(`调用AI模型失败: ${error.message}`);
  }
}

// 调用通义千问API
exports.callQwenApi = async function (messages, apiKey, apiBaseUrl, modelId, userEnableThinking) {
  try {
    // 选择模型，如果没有指定则使用默认模型
    const model = modelId || 'qwen-max';

    // 检查是否是视觉模型
    const isVisual = isVisualModel(model);

    // 检查是否是qwen3模型（支持思考模式）
    const isQwen3 = model.toLowerCase().includes('qwen3');

    // 是否启用思考模式（用户设置优先）
    let enableThinking = userEnableThinking;

    // 如果用户没有明确设置，使用默认值
    if (enableThinking === undefined) {
      // QwQ模型自动启用思考模式
      if (model.toLowerCase().includes('qwq')) {
        enableThinking = true;
      }
      // qwen3-235b-a22b模型默认启用思考模式
      else if (isQwen3 && model.toLowerCase().includes('235b-a22b')) {
        enableThinking = true;
      }
      else {
        enableThinking = false;
      }
    }

    // QwQ模型特殊处理
    const isQwQ = model.toLowerCase().includes('qwq');

    // 构建请求参数
    const requestBody = {
      model: model,
      messages: messages
    };

    // qwen3-235b-a22b 模型强制启用流式输出
    if (model.toLowerCase().includes('qwen3-235b-a22b')) {
      requestBody.stream = true;
    }

    // 如果是qwen3模型或QwQ模型且启用思考模式，添加相关参数
    if ((isQwen3 || isQwQ) && enableThinking) {
      requestBody.enable_thinking = true;
      requestBody.stream = true; // 思考模式下强制启用流式输出
      requestBody.max_tokens = 4000; // 可选参数
    }

    // 打印请求体，用于调试
    // console.log('通义千问API请求体:', JSON.stringify(requestBody, null, 2));

    // 检查是否需要流式输出
    if (requestBody.stream) {
      console.log('使用流式输出模式');

      // 使用流式输出模式
      const response = await axios.post(
        `${apiBaseUrl}/chat/completions`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );

      // 处理流式响应
      return new Promise((resolve, reject) => {
        let fullContent = '';
        let thoughtChain = '';
        let debugData = []; // 用于收集调试数据

        response.data.on('data', (chunk) => {
          try {
            // 将二进制数据转换为字符串
            const chunkStr = chunk.toString();

            // 处理数据块
            const lines = chunkStr.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
              // 跳过注释行
              if (line.startsWith(':')) continue;

              // 移除 "data: " 前缀
              const jsonStr = line.replace(/^data: /, '');

              // 跳过 [DONE] 消息
              if (jsonStr.trim() === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);

                // 收集调试数据
                debugData.push(data);

                // 处理思考内容
                if (enableThinking && data.choices[0].reasoning_content) {
                  thoughtChain = data.choices[0].reasoning_content;
                }

                // 处理内容增量
                if (data.choices[0].delta && data.choices[0].delta.content) {
                  fullContent += data.choices[0].delta.content;
                }

                // 处理完整消息
                if (data.choices[0].message && data.choices[0].message.content) {
                  fullContent = data.choices[0].message.content;
                }
              } catch (parseError) {
                console.error('解析流式响应JSON错误:', parseError);
              }
            }
          } catch (error) {
            console.error('处理流式响应块错误:', error);
          }
        });

        response.data.on('end', () => {
          console.log('流式响应结束');

          // 输出调试信息
          console.log('API回复调试信息:');
          console.log(JSON.stringify(debugData, null, 2));

          // 如果启用了思考模式且有思考链，添加到内容中
          if (enableThinking && thoughtChain) {
            fullContent = `<thought>${thoughtChain}</thought>\n\n${fullContent}`;
          }

          resolve(fullContent);
        });

        response.data.on('error', (err) => {
          console.error('流式响应错误:', err);
          reject(err);
        });
      });
    } else {
      // 使用普通模式
      const response = await axios.post(
        `${apiBaseUrl}/chat/completions`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // 打印响应，用于调试
      console.log('通义千问API响应:', JSON.stringify(response.data, null, 2));

      // 输出调试信息
      console.log('API回复调试信息:');
      console.log(JSON.stringify(response.data, null, 2));

      // 处理响应
      const aiMessage = response.data.choices[0].message;
      let content = aiMessage.content;
      let thoughtChain = null;

      // 如果启用了思考模式，提取思考内容
      if (enableThinking && response.data.choices[0].reasoning_content) {
        thoughtChain = response.data.choices[0].reasoning_content;
        // 构建包含思考链和正式回复的完整响应
        content = `<thought>${thoughtChain}</thought>\n\n${content}`;
      }

      // 处理视觉模型的多模态响应
      if (isVisual && typeof content === 'object') {
        // 处理多模态响应
        const contentArray = Array.isArray(content) ? content : [content];

        // 提取文本部分
        let textParts = [];

        for (const part of contentArray) {
          if (part.type === 'text') {
            textParts.push(part.text);
          }
        }

        // 合并文本部分
        content = textParts.join('\n');
      }

      return content;
    }
  } catch (error) {
    console.error('调用通义千问API错误:', error.response?.data || error.message);
    if (error.response && error.response.data) {
      console.error('错误详情:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}



// 调用DeepSeek API
async function callDeepseekApi(messages, apiKey, apiBaseUrl, modelId) {
  try {
    // 选择模型，如果没有指定则使用默认模型
    const model = modelId || 'deepseek-chat';

    const response = await axios.post(
      `${apiBaseUrl}/chat/completions`,
      {
        model: model,
        messages: messages
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('调用DeepSeek API错误:', error.response?.data || error.message);
    throw error;
  }
}

// 调用百川API
async function callBaichuanApi(messages, apiKey, apiBaseUrl, modelId) {
  try {
    // 选择模型，如果没有指定则使用默认模型
    const model = modelId || 'baichuan-turbo';

    const response = await axios.post(
      `${apiBaseUrl}/chat/completions`,
      {
        model: model,
        messages: messages
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('调用百川API错误:', error.response?.data || error.message);
    throw error;
  }
}

// 调用智谱ChatGLM API
async function callChatGLMApi(messages, apiKey, apiBaseUrl, modelId) {
  try {
    // 选择模型，如果没有指定则使用默认模型
    const model = modelId || 'chatglm_turbo';

    // 智谱API格式可能与OpenAI不同，需要根据实际情况调整
    const response = await axios.post(
      `${apiBaseUrl}/chat/completions`,
      {
        model: model,
        messages: messages
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('调用智谱ChatGLM API错误:', error.response?.data || error.message);
    throw error;
  }
}
