const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'patent_extractor',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 中间件
// 配置CORS，允许前端应用访问
app.use(cors({
  origin: ['http://localhost:3001', 'http://127.0.0.1:3001'], // 允许的前端域名和端口
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // 允许携带凭证
}));

// 配置Helmet，但允许图片加载
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // 允许跨域加载资源
}));

app.use(compression());
app.use(bodyParser.json({ limit: '50mb' })); // 增加JSON请求体大小限制
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' })); // 增加URL编码请求体大小限制
app.use(morgan('dev'));

// 静态文件服务 - 确保能够访问所有上传的文件
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, filePath) => {
    // 为图片文件设置缓存头和CORS头
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.png') || filePath.endsWith('.gif')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天
      res.setHeader('Content-Type', 'image/' + filePath.split('.').pop());

      // 添加CORS头
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  },
  // 设置更宽松的选项
  dotfiles: 'allow',
  etag: true,
  extensions: ['jpg', 'jpeg', 'png', 'gif', 'md', 'pdf'],
  index: false,
  maxAge: '1d',
  redirect: false,
  fallthrough: true
}));

// 速率限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP限制100个请求
  standardHeaders: true,
  legacyHeaders: false,
  // 跳过图片请求的速率限制
  skip: (req) => {
    return req.path.includes('/files/') && req.path.includes('/images/');
  }
});
app.use('/api/', apiLimiter);

// 将数据库连接池添加到请求对象
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// 路由
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const patentRoutes = require('./routes/patent.routes');
const extractionRoutes = require('./routes/extraction.routes');
const chatRoutes = require('./routes/chat.routes');
const pdfRoutes = require('./routes/pdf.routes');
const imageRoutes = require('./routes/image.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patents', patentRoutes);
app.use('/api/extraction', extractionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/images', imageRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

module.exports = app;
