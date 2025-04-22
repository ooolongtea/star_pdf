const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// 注册新用户
router.post('/register', authController.register);

// 用户登录
router.post('/login', authController.login);

// 退出登录
router.post('/logout', authMiddleware.verifyToken, authController.logout);

// 获取当前用户信息
router.get('/me', authMiddleware.verifyToken, authController.getCurrentUser);

// 发送验证码
router.post('/verification-code', authController.sendVerificationCode);

// 验证令牌
router.get('/verify-token', authController.verifyToken);

module.exports = router;
