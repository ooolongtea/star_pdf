# 文献专利化学式提取系统

一个现代化的文献专利化学式提取系统，基于Vue.js和Node.js构建，用于从专利文档中提取化学式和反应信息。系统支持PDF、Word和Excel文件处理，并提供AI聊天功能辅助分析。

## 功能特点

- 基于Vue.js的现代化用户界面
- 用户认证系统（登录/注册）
- 专利文档上传和管理
- 化学式和反应提取
- 提取结果可视化
- 本地数据存储（MySQL）
- 与远程化学式提取服务器集成
- PDF转Markdown功能
- AI聊天分析功能（支持多种模型）
- 图像处理和显示
- 用户配置管理

## 技术栈

### 前端

- Vue.js 3
- Vue Router
- Vuex
- Tailwind CSS
- Axios
- v-md-editor（Markdown渲染）

### 后端

- Node.js
- Express
- MySQL
- JWT认证
- Multer（文件上传）
- Python服务（用于化学式提取和PDF处理）

### 远程服务

- FastAPI（Python后端API）
- 多GPU并行处理
- 文档解析引擎

## 安装和运行

### 前提条件

- Node.js (>= 14.x)
- MySQL (>= 5.7)
- Python 3.8+（用于远程服务）
- GPU服务器（可选，用于加速处理）

### 安装步骤

1. 克隆仓库

    ```bash
    git clone https://github.com/yourusername/patent-extractor.git
    cd patent-extractor
    ```

2. 安装依赖

    ```bash
    npm install
    ```

3. 配置环境变量

    复制`.env.example`文件为`.env`，并根据实际情况修改配置。

4. 创建数据库

    ```bash
    node database/run_migration.js
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

## 系统架构

系统由三个主要组件构成：

1. **Web客户端和本地服务器**：处理用户界面、认证和文件管理
2. **远程MinerU服务器**：处理PDF转Markdown和化学式提取（默认地址：`http://172.19.1.81:8010`）
3. **远程化学式提取服务器**：专门处理化学式识别（默认地址：`http://172.19.1.81:8011`）

用户可以在设置中配置这些服务器的URL。

## 项目结构

```bash
patent-extractor/
├── public/                      # 静态资源
├── src/                         # 前端源代码
│   ├── assets/                  # 资源文件
│   ├── components/              # 通用组件
│   ├── views/                   # 页面视图
│   ├── router/                  # 路由配置
│   ├── store/                   # Vuex状态管理
│   ├── utils/                   # 工具函数
│   ├── plugins/                 # 插件配置
│   ├── config/                  # 配置文件
│   ├── App.vue                  # 根组件
│   └── main.js                  # 入口文件
├── server/                      # 后端服务器代码
│   ├── config/                  # 配置文件
│   ├── controllers/             # 控制器
│   ├── models/                  # 数据模型
│   ├── routes/                  # 路由定义
│   ├── middlewares/             # 中间件
│   ├── utils/                   # 工具函数
│   └── server.js                # 服务器入口
├── database/                    # 数据库相关
│   ├── migrations/              # 数据库迁移脚本
│   ├── schema.sql               # 主数据库结构
│   ├── api_keys.sql             # API密钥表结构
│   ├── chat_tables.sql          # 聊天相关表结构
│   ├── migrate.js               # 数据库迁移执行脚本
│   ├── backup.js                # 数据库备份脚本
│   ├── restore.js               # 数据库恢复脚本
│   └── db-manager.js            # 数据库管理模块
├── star_pdf/                    # Python服务代码
│   ├── img_extractor/           # 图像提取服务
│   ├── mineru/                  # MinerU服务
│   ├── local_process/           # 本地处理模块
│   └── onlineStrategyPatternV3/ # 在线处理策略
├── uploads/                     # 上传文件存储目录
└── server.js                    # 生产环境服务器入口
```

## API文档

### 认证API

- `POST /api/auth/register` - 注册新用户
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户退出登录
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/verification-code` - 发送验证码

### PDF处理API

- `POST /api/pdf/upload` - 上传PDF文件
- `GET /api/pdf/files` - 获取PDF文件列表
- `GET /api/pdf/files/:id` - 获取PDF文件详情
- `DELETE /api/pdf/files/:id` - 删除PDF文件
- `GET /api/pdf/files/:id/results` - 获取PDF处理结果
- `GET /api/pdf/files/:id/download` - 下载PDF处理结果
- `GET /api/pdf/files/:id/download-all` - 下载所有处理结果

### 聊天API

- `GET /api/chat/conversations` - 获取聊天会话列表
- `POST /api/chat/conversations` - 创建新会话
- `GET /api/chat/conversations/:id` - 获取会话详情
- `DELETE /api/chat/conversations/:id` - 删除会话
- `POST /api/chat/messages` - 发送消息
- `GET /api/chat/models` - 获取可用AI模型列表

### 图像API

- `POST /api/images/upload` - 上传图像
- `GET /api/images/:id` - 获取图像

### 用户设置API

- `GET /api/users/settings` - 获取用户设置
- `PUT /api/users/settings` - 更新用户设置
- `GET /api/users/api-keys` - 获取用户API密钥
- `PUT /api/users/api-keys` - 更新用户API密钥

## 许可证

[MIT](LICENSE)

## 联系方式

如有任何问题或建议，请联系项目维护者。
