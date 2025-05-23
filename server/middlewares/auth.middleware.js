const User = require('../models/user.model');

// 验证令牌中间件
exports.verifyToken = async (req, res, next) => {
  try {
    let token;

    // 从请求头中获取令牌
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 如果请求头中没有令牌，尝试从请求体中获取
    if (!token && req.body && req.body.token) {
      token = req.body.token;
    }

    // 如果仍然没有令牌，返回错误
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供授权令牌'
      });
    }

    // 验证令牌
    const userModel = new User(req.db);
    const session = await userModel.verifySession(token);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: '令牌无效或已过期'
      });
    }

    // 将用户信息添加到请求对象
    req.user = {
      id: session.user_id,
      username: session.username,
      email: session.email,
      role: session.role
    };

    next();
  } catch (error) {
    console.error('验证令牌错误:', error);
    res.status(500).json({
      success: false,
      message: '验证令牌过程中发生错误',
      error: error.message
    });
  }
};

// 验证管理员权限中间件
exports.verifyAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '需要管理员权限'
    });
  }
  next();
};
