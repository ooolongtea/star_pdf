/**
 * 请求限流中间件
 * 用于限制API请求频率，防止过多请求导致服务器负载过高
 */

// 存储请求计数的对象
const requestCounts = {};

// 清理过期计数的定时器
setInterval(() => {
  const now = Date.now();
  for (const key in requestCounts) {
    if (now - requestCounts[key].timestamp > 60000) { // 60秒后清理
      delete requestCounts[key];
    }
  }
}, 60000); // 每分钟清理一次

/**
 * 创建限流中间件
 * @param {Object} options 配置选项
 * @param {number} options.windowMs 时间窗口（毫秒）
 * @param {number} options.maxRequests 最大请求数
 * @param {string} options.message 超出限制时的错误消息
 * @returns {Function} Express中间件函数
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60000; // 默认1分钟
  const maxRequests = options.maxRequests || 60; // 默认每分钟60次
  const message = options.message || '请求过于频繁，请稍后再试';

  return (req, res, next) => {
    // 获取客户端标识（IP + 路径）
    const clientId = `${req.ip}-${req.originalUrl}`;
    const now = Date.now();

    // 初始化或更新请求计数
    if (!requestCounts[clientId] || now - requestCounts[clientId].timestamp > windowMs) {
      requestCounts[clientId] = {
        count: 1,
        timestamp: now
      };
    } else {
      requestCounts[clientId].count++;
    }

    // 检查是否超出限制
    if (requestCounts[clientId].count > maxRequests) {
      console.log(`请求限流: ${clientId} 超出限制 (${maxRequests}/${windowMs}ms)`);
      return res.status(429).json({
        success: false,
        message: message,
        retryAfter: Math.ceil((requestCounts[clientId].timestamp + windowMs - now) / 1000)
      });
    }

    next();
  };
}

// 任务状态API的限流中间件
const taskStatusLimiter = createRateLimiter({
  windowMs: 10000, // 10秒
  maxRequests: 5,  // 每10秒最多5次请求
  message: '请求任务状态过于频繁，请减少轮询频率'
});

module.exports = {
  createRateLimiter,
  taskStatusLimiter
};
