const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// 所有聊天路由都需要认证
router.use(authMiddleware.verifyToken);

// 获取用户的所有对话
router.get('/conversations', chatController.getConversations);

// 创建新对话
router.post('/conversations', chatController.createConversation);

// 获取特定对话及其消息
router.get('/conversations/:id', chatController.getConversation);

// 更新对话标题
router.put('/conversations/:id', chatController.updateConversation);

// 删除对话
router.delete('/conversations/:id', chatController.deleteConversation);

// 发送消息并获取AI回复
router.post('/conversations/:id/messages', chatController.sendMessage);

module.exports = router;
