const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

// 这里我们可以添加用户相关的路由
// 目前只添加一个获取用户信息的路由作为示例

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
    const userId = req.user.id;
    
    // 创建用户模型实例
    const User = require('../models/user.model');
    const userModel = new User(req.db);
    
    // 更新用户信息
    const success = await userModel.update(userId, { fullName });
    
    if (success) {
      res.status(200).json({
        success: true,
        message: '用户信息已更新'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '更新用户信息失败'
      });
    }
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '更新用户信息失败',
      error: error.message
    });
  }
});

// 更新密码
router.put('/password', authMiddleware.verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    // 验证参数
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '当前密码和新密码都是必需的'
      });
    }
    
    // 创建用户模型实例
    const User = require('../models/user.model');
    const userModel = new User(req.db);
    
    // 获取用户信息
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 验证当前密码
    const isPasswordValid = await userModel.verifyPassword(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '当前密码不正确'
      });
    }
    
    // 更新密码
    const success = await userModel.update(userId, { password: newPassword });
    
    if (success) {
      res.status(200).json({
        success: true,
        message: '密码已更新'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '更新密码失败'
      });
    }
  } catch (error) {
    console.error('更新密码错误:', error);
    res.status(500).json({
      success: false,
      message: '更新密码失败',
      error: error.message
    });
  }
});

module.exports = router;
