# 文献专利化学式提取系统

一个现代化的文献专利化学式提取系统，基于Vue.js和Node.js构建，用于从专利文档中提取化学式和反应信息。

## 功能特点

- 基于Vue.js的现代化用户界面
- 用户认证系统（登录/注册）
- 专利文档上传和管理
- 化学式和反应提取
- 提取结果可视化
- 本地数据存储（MySQL）
- 与远程化学式提取服务器集成

## 技术栈

### 前端
- Vue.js 3
- Vue Router
- Vuex
- Tailwind CSS
- Axios

### 后端
- Node.js
- Express
- MySQL
- JWT认证
- Multer（文件上传）

## 安装和运行

### 前提条件
- Node.js (>= 14.x)
- MySQL (>= 5.7)
- 远程化学式提取服务器（可选）

### 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/yourusername/patent-extractor-client.git
cd patent-extractor-client
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
复制`.env.example`文件为`.env`，并根据实际情况修改配置。

4. 创建数据库
```bash
mysql -u root -p < database/schema.sql
```

5. 启动开发服务器
```bash
# 启动前端开发服务器
npm run serve

# 启动后端服务器
npm run server
```

6. 构建生产版本
```bash
npm run build
```

## 项目结构

```
patent-extractor-client/
├── public/                      # 静态资源
├── src/                         # 前端源代码
│   ├── assets/                  # 资源文件
│   ├── components/              # 通用组件
│   ├── views/                   # 页面视图
│   ├── router/                  # 路由配置
│   ├── store/                   # Vuex状态管理
│   ├── services/                # API服务
│   ├── utils/                   # 工具函数
│   ├── plugins/                 # 插件配置
│   ├── App.vue                  # 根组件
│   └── main.js                  # 入口文件
├── server/                      # 后端服务器代码
│   ├── config/                  # 配置文件
│   ├── controllers/             # 控制器
│   ├── models/                  # 数据模型
│   ├── routes/                  # 路由定义
│   ├── middlewares/             # 中间件
│   └── server.js                # 服务器入口
├── database/                    # 数据库相关
│   └── schema.sql               # 数据库模式
└── uploads/                     # 上传文件存储目录
```

## API文档

### 认证API
- `POST /api/auth/register` - 注册新用户
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户退出登录
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/verification-code` - 发送验证码

### 提取API
- `POST /api/extraction/upload` - 上传专利文件
- `GET /api/extraction/patents` - 获取专利列表
- `GET /api/extraction/patents/:id` - 获取专利详情
- `DELETE /api/extraction/patents/:id` - 删除专利
- `POST /api/extraction/patents/:id/process` - 处理专利
- `GET /api/extraction/tasks/:taskId` - 获取任务状态
- `GET /api/extraction/tasks` - 获取任务列表
- `GET /api/extraction/settings` - 获取用户设置
- `PUT /api/extraction/settings` - 更新用户设置

## 许可证

[MIT](LICENSE)

## 联系方式

如有任何问题或建议，请联系：your-email@example.com
