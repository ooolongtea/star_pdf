const express = require('express');
const router = express.Router();
const extractionController = require('../controllers/extraction.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// 所有路由都需要验证令牌
router.use(authMiddleware.verifyToken);

// 上传专利文件
router.post('/upload', extractionController.uploadPatent);

// 获取用户的专利列表
router.get('/patents', extractionController.getPatents);

// 获取专利详情
router.get('/patents/:id', extractionController.getPatentDetails);

// 删除专利
router.delete('/patents/:id', extractionController.deletePatent);

// 处理专利提取
router.post('/patents/:id/process', extractionController.processPatent);

// 获取任务状态
router.get('/tasks/:taskId', extractionController.getTaskStatus);

// 获取用户的任务列表
router.get('/tasks', extractionController.getTasks);

// 获取用户设置
router.get('/settings', extractionController.getSettings);

// 更新用户设置
router.put('/settings', extractionController.updateSettings);

module.exports = router;
