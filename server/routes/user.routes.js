const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const apiKeyController = require('../controllers/apiKey.controller');

// 获取用户信息
router.get('/profile', authMiddleware.verifyToken, async (req, res) => {
  try {
    // 用户信息已经在auth中间件中添加到req对象
    const user = req.user;

    // 返回用户信息（不包含敏感数据）
    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败',
      error: error.message
    });
  }
});

// 更新用户信息
router.put('/profile', authMiddleware.verifyToken, async (req, res) => {
  try {
    const { fullName } = req.body;

    // 更新用户信息
    await req.db.execute(
      'UPDATE users SET full_name = ?, updated_at = NOW() WHERE id = ?',
      [fullName || null, req.user.id]
    );

    res.status(200).json({
      success: true,
      message: '用户信息已更新'
    });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '更新用户信息失败',
      error: error.message
    });
  }
});

// 更新用户密码
router.put('/password', authMiddleware.verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 验证必填字段
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '请提供当前密码和新密码'
      });
    }

    // 获取用户当前密码
    const [rows] = await req.db.execute(
      'SELECT password FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 验证当前密码
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(currentPassword, rows[0].password);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: '当前密码错误'
      });
    }

    // 加密新密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 更新密码
    await req.db.execute(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    res.status(200).json({
      success: true,
      message: '密码已更新'
    });
  } catch (error) {
    console.error('更新密码错误:', error);
    res.status(500).json({
      success: false,
      message: '更新密码失败',
      error: error.message
    });
  }
});

// API密钥相关路由
// 获取所有API密钥
router.get('/api-keys', authMiddleware.verifyToken, apiKeyController.getApiKeys);

// 创建API密钥
router.post('/api-keys', authMiddleware.verifyToken, apiKeyController.createApiKey);

// 更新API密钥
router.put('/api-keys/:id', authMiddleware.verifyToken, apiKeyController.updateApiKey);

// 删除API密钥
router.delete('/api-keys/:id', authMiddleware.verifyToken, apiKeyController.deleteApiKey);

// 获取特定模型的API密钥
router.get('/api-keys/model/:model_name', authMiddleware.verifyToken, apiKeyController.getApiKeyByModel);

module.exports = router;
