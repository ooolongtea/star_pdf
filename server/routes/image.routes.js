const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middlewares/auth.middleware');

// 所有图片路由都需要认证
router.use(authMiddleware.verifyToken);

/**
 * 获取图片 - 支持模块化路径
 * 路由格式: /api/images/:module/:path(*)
 * 例如: /api/images/chat/123456.jpg - 访问聊天模块的图片
 *      /api/images/pdf/987654.png - 访问PDF模块的图片
 */
router.get('/:module/:path(*)', (req, res) => {
  try {
    const { module, path: imagePath } = req.params;

    // 构建完整路径 - 使用模块名称作为子目录
    // 例如: uploads/chat/images/123456.jpg
    const fullPath = path.join(process.cwd(), 'uploads', module, imagePath);

    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      console.error(`图片不存在: ${fullPath}`);
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    // 设置缓存头
    const ext = path.extname(fullPath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天
      res.setHeader('Content-Type', `image/${ext.substring(1)}`);
    }

    // 发送文件
    res.sendFile(fullPath);
  } catch (error) {
    console.error('获取图片错误:', error);
    res.status(500).json({
      success: false,
      message: '获取图片失败',
      error: error.message
    });
  }
});

/**
 * 兼容旧版路径格式
 * 路由格式: /api/images/:path(*)
 */
router.get('/:path(*)', (req, res) => {
  try {
    const imagePath = req.params.path;
    const fullPath = path.join(process.cwd(), imagePath);

    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      console.error(`图片不存在: ${fullPath}`);
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    // 设置缓存头
    const ext = path.extname(fullPath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天
      res.setHeader('Content-Type', `image/${ext.substring(1)}`);
    }

    // 发送文件
    res.sendFile(fullPath);
  } catch (error) {
    console.error('获取图片错误:', error);
    res.status(500).json({
      success: false,
      message: '获取图片失败',
      error: error.message
    });
  }
});

module.exports = router;
