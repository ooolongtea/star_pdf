// 获取用户的API密钥列表
exports.getApiKeys = async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      'SELECT id, user_id, model_name, api_key, api_base_url, is_active, created_at, updated_at FROM api_keys WHERE user_id = ?',
      [req.user.id]
    );

    // 不返回完整的API密钥，只返回部分掩码
    const apiKeys = rows.map(key => {
      return {
        ...key,
        api_key: maskApiKey(key.api_key)
      };
    });

    res.status(200).json({
      success: true,
      data: {
        apiKeys
      }
    });
  } catch (error) {
    console.error('获取API密钥错误:', error);
    res.status(500).json({
      success: false,
      message: '获取API密钥过程中发生错误',
      error: error.message
    });
  }
};

// 创建新的API密钥
exports.createApiKey = async (req, res) => {
  try {
    const { model_name, api_key, api_base_url, is_active } = req.body;

    // 验证必填字段
    if (!model_name || !api_key) {
      return res.status(400).json({
        success: false,
        message: '请提供模型名称和API密钥'
      });
    }

    // 检查是否已存在相同模型的API密钥
    const [existingRows] = await req.db.execute(
      'SELECT id FROM api_keys WHERE user_id = ? AND model_name = ?',
      [req.user.id, model_name]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: '已存在相同模型的API密钥，请使用更新功能'
      });
    }

    // 插入新的API密钥
    await req.db.execute(
      'INSERT INTO api_keys (user_id, model_name, api_key, api_base_url, is_active) VALUES (?, ?, ?, ?, ?)',
      [
        req.user.id,
        model_name,
        api_key,
        api_base_url || null,
        is_active ? 1 : 0
      ]
    );

    res.status(201).json({
      success: true,
      message: 'API密钥已创建'
    });
  } catch (error) {
    console.error('创建API密钥错误:', error);
    res.status(500).json({
      success: false,
      message: '创建API密钥过程中发生错误',
      error: error.message
    });
  }
};

// 更新API密钥
exports.updateApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const { api_key, api_base_url, is_active } = req.body;

    // 验证必填字段
    if (!api_key) {
      return res.status(400).json({
        success: false,
        message: '请提供API密钥'
      });
    }

    // 检查API密钥是否存在且属于当前用户
    const [rows] = await req.db.execute(
      'SELECT id FROM api_keys WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API密钥不存在或无权访问'
      });
    }

    // 更新API密钥
    await req.db.execute(
      'UPDATE api_keys SET api_key = ?, api_base_url = ?, is_active = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
      [
        api_key,
        api_base_url || null,
        is_active ? 1 : 0,
        id,
        req.user.id
      ]
    );

    res.status(200).json({
      success: true,
      message: 'API密钥已更新'
    });
  } catch (error) {
    console.error('更新API密钥错误:', error);
    res.status(500).json({
      success: false,
      message: '更新API密钥过程中发生错误',
      error: error.message
    });
  }
};

// 删除API密钥
exports.deleteApiKey = async (req, res) => {
  try {
    const { id } = req.params;

    // 检查API密钥是否存在且属于当前用户
    const [rows] = await req.db.execute(
      'SELECT id FROM api_keys WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API密钥不存在或无权访问'
      });
    }

    // 删除API密钥
    await req.db.execute(
      'DELETE FROM api_keys WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    res.status(200).json({
      success: true,
      message: 'API密钥已删除'
    });
  } catch (error) {
    console.error('删除API密钥错误:', error);
    res.status(500).json({
      success: false,
      message: '删除API密钥过程中发生错误',
      error: error.message
    });
  }
};

// 获取特定模型的API密钥
exports.getApiKeyByModel = async (req, res) => {
  try {
    const { model_name } = req.params;

    const [rows] = await req.db.execute(
      'SELECT id, user_id, model_name, api_key, api_base_url, is_active FROM api_keys WHERE user_id = ? AND model_name = ? AND is_active = 1',
      [req.user.id, model_name]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到该模型的API密钥'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        apiKey: rows[0]
      }
    });
  } catch (error) {
    console.error('获取API密钥错误:', error);
    res.status(500).json({
      success: false,
      message: '获取API密钥过程中发生错误',
      error: error.message
    });
  }
};

// 辅助函数：掩码API密钥
function maskApiKey(apiKey) {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '********';
  return apiKey.substring(0, 4) + '****' + apiKey.substring(apiKey.length - 4);
}
