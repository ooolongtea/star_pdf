const express = require('express');
const path = require('path');
const history = require('connect-history-api-fallback');
const serveStatic = require('serve-static');

const app = express();

// 启用 history 模式
app.use(history());

// 静态文件服务
app.use(serveStatic(path.join(__dirname, 'dist')));

// 所有路由都返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  // console.log(`服务器运行在 http://localhost:${port}`);
});
