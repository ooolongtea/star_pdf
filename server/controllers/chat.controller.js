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
    const { message, image } = req.body;

    if (!message && !image) {
      return res.status(400).json({
        success: false,
        message: '请提供消息内容或图片'
      });
    }

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
    let modelId = null;

    if (conversation.model_name.includes(':')) {
      [providerId, modelId] = conversation.model_name.split(':');
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
    const aiResponse = await callAiModel(conversation.model_name, messageHistory, apiKey, apiBaseUrl);

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
async function callAiModel(modelName, messages, apiKey, apiBaseUrl) {
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
        response = await callQwenApi(messages, apiKey, apiBaseUrl, modelId);
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
async function callQwenApi(messages, apiKey, apiBaseUrl, modelId) {
  try {
    // 选择模型，如果没有指定则使用默认模型
    const model = modelId || 'qwen-max';

    // 检查是否是视觉模型
    const isVisual = isVisualModel(model);

    // 构建请求参数
    const requestBody = {
      model: model,
      messages: messages
    };

    // // 如果是视觉模型，可以添加额外参数
    // if (isVisual) {
    //   // 可以添加max_tokens等参数
    //   requestBody.max_tokens = 1500;
    // }

    // 打印请求体，用于调试
    console.log('通义千问API请求体:', JSON.stringify(requestBody, null, 2));

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

    // 处理响应
    const aiMessage = response.data.choices[0].message;
    let content = aiMessage.content;

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
