const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdf.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// 应用认证中间件
router.use(authMiddleware.verifyToken);

// 测试与远程服务器的连接
router.get('/test-connection', pdfController.testConnection);

// PDF 转换路由
router.post('/convert', pdfController.convertPdf);

// 获取用户的PDF文件列表
router.get('/files', pdfController.getUserFiles);

// 获取单个PDF文件的详细信息
router.get('/files/:id', pdfController.getFileDetails);

// 删除PDF文件
router.delete('/files/:id', pdfController.deleteFile);

module.exports = router;
