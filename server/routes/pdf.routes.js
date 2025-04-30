const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdf.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// 不需要认证的路由
router.get('/files/:id/images/:imageName', pdfController.getImageFile);
router.get('/test-connection', pdfController.testConnection);

// 应用认证中间件（对其他所有路由）
router.use(authMiddleware.verifyToken);

// PDF 转换路由
router.post('/convert', pdfController.convertPdf);

// 获取用户的PDF文件列表
router.get('/files', pdfController.getUserFiles);

// 获取单个PDF文件的详细信息
router.get('/files/:id', pdfController.getFileDetails);

// 删除PDF文件
router.delete('/files/:id', pdfController.deleteFile);

// 获取PDF文件的所有结果文件列表
router.get('/files/:id/results', pdfController.getFileResults);

// 下载特定结果文件
router.get('/files/:id/download', pdfController.downloadResultFile);

// 下载所有结果（打包为ZIP）
router.get('/files/:id/download-all', pdfController.downloadAllResults);

module.exports = router;
