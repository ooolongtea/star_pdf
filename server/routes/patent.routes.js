const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const extractionController = require('../controllers/extraction.controller');

// 所有路由都需要验证令牌
router.use(authMiddleware.verifyToken);

// 获取专利列表 (这个路由已经在extraction.routes.js中定义，这里只是为了完整性)
router.get('/', extractionController.getPatents);

// 获取专利详情 (这个路由已经在extraction.routes.js中定义，这里只是为了完整性)
router.get('/:id', extractionController.getPatentDetails);

// 删除专利 (这个路由已经在extraction.routes.js中定义，这里只是为了完整性)
router.delete('/:id', extractionController.deletePatent);

module.exports = router;
