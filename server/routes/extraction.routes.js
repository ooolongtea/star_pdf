const express = require('express');
const router = express.Router();
const extractionController = require('../controllers/extraction.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const rateLimitMiddleware = require('../middlewares/rate-limit.middleware');

// 不需要认证的路由
router.get('/test-connection', extractionController.testConnection);

// 其他所有路由都需要验证令牌
router.use(authMiddleware.verifyToken);

// 上传专利文件
router.post('/upload', extractionController.uploadPatent);

// 获取用户的专利列表
router.get('/patents', extractionController.getPatents);

// 获取专利详情
router.get('/patents/:id', extractionController.getPatentDetails);

// 调试路由 - 获取分子和反应数据的原始路径
router.get('/debug/paths/:patentId', async (req, res) => {
    try {
        const { patentId } = req.params;
        const db = req.db;

        // 查询分子数据
        const [molecules] = await db.execute(
            'SELECT id, image_path, visualization_path FROM molecules WHERE patent_id = ? LIMIT 10',
            [patentId]
        );

        // 查询反应数据
        const [reactions] = await db.execute(
            'SELECT id, image_path FROM reactions WHERE patent_id = ? LIMIT 10',
            [patentId]
        );

        res.status(200).json({
            success: true,
            data: {
                molecules,
                reactions
            }
        });
    } catch (error) {
        console.error('调试路径错误:', error);
        res.status(500).json({
            success: false,
            message: '获取路径数据失败',
            error: error.message
        });
    }
});

// 删除专利
router.delete('/patents/:id', extractionController.deletePatent);

// 处理专利提取
router.post('/patents/:id/process', extractionController.processPatent);

// 下载专利结果
router.get('/patents/:id/download', extractionController.downloadPatentResults);

// 批量处理专利
router.post('/patents/batch/process', extractionController.processBatchPatents);

// 批量下载结果
router.post('/patents/batch/download', extractionController.downloadBatchResults);

// 批量删除专利
router.post('/patents/batch/delete', extractionController.deleteBatchPatents);

// 获取任务状态（添加限流中间件）
router.get('/tasks/:taskId', rateLimitMiddleware.taskStatusLimiter, extractionController.getTaskStatus);

// 获取用户的任务列表
router.get('/tasks', extractionController.getTasks);

// 获取用户设置
router.get('/settings', extractionController.getSettings);

// 更新用户设置
router.put('/settings', extractionController.updateSettings);

module.exports = router;
