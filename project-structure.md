# 文献专利化学式提取系统 - 项目结构

```
patent-extractor-client/
├── public/                      # 静态资源
│   ├── favicon.ico              # 网站图标
│   └── index.html               # HTML模板
├── src/                         # 源代码
│   ├── assets/                  # 资源文件
│   │   ├── images/              # 图片资源
│   │   ├── styles/              # 全局样式
│   │   └── fonts/               # 字体资源
│   ├── components/              # 通用组件
│   │   ├── common/              # 公共组件
│   │   │   ├── AppHeader.vue    # 应用头部
│   │   │   ├── AppFooter.vue    # 应用底部
│   │   │   ├── AppSidebar.vue   # 侧边栏
│   │   │   └── ...
│   │   ├── auth/                # 认证相关组件
│   │   │   ├── LoginForm.vue    # 登录表单
│   │   │   ├── RegisterForm.vue # 注册表单
│   │   │   └── ...
│   │   └── extraction/          # 化学式提取相关组件
│   │       ├── UploadArea.vue   # 上传区域
│   │       ├── ResultViewer.vue # 结果查看器
│   │       ├── MoleculeCard.vue # 分子卡片
│   │       └── ...
│   ├── views/                   # 页面视图
│   │   ├── Home.vue             # 首页
│   │   ├── Login.vue            # 登录页
│   │   ├── Register.vue         # 注册页
│   │   ├── Dashboard.vue        # 仪表盘
│   │   ├── Extraction.vue       # 化学式提取页面
│   │   ├── Results.vue          # 结果页面
│   │   └── ...
│   ├── router/                  # 路由配置
│   │   └── index.js             # 路由定义
│   ├── store/                   # Vuex状态管理
│   │   ├── index.js             # Store入口
│   │   ├── modules/             # 模块化Store
│   │   │   ├── auth.js          # 认证模块
│   │   │   ├── extraction.js    # 提取模块
│   │   │   └── ...
│   ├── services/                # API服务
│   │   ├── api.js               # API基础配置
│   │   ├── auth.service.js      # 认证服务
│   │   ├── extraction.service.js # 提取服务
│   │   └── ...
│   ├── utils/                   # 工具函数
│   │   ├── validators.js        # 表单验证
│   │   ├── formatters.js        # 数据格式化
│   │   └── ...
│   ├── plugins/                 # 插件配置
│   │   ├── axios.js             # Axios配置
│   │   └── ...
│   ├── constants/               # 常量定义
│   │   └── index.js             # 常量导出
│   ├── App.vue                  # 根组件
│   └── main.js                  # 入口文件
├── server/                      # 本地服务器代码
│   ├── config/                  # 配置文件
│   │   ├── db.js                # 数据库配置
│   │   └── ...
│   ├── controllers/             # 控制器
│   │   ├── auth.controller.js   # 认证控制器
│   │   ├── extraction.controller.js # 提取控制器
│   │   └── ...
│   ├── models/                  # 数据模型
│   │   ├── user.model.js        # 用户模型
│   │   ├── patent.model.js      # 专利模型
│   │   └── ...
│   ├── routes/                  # 路由定义
│   │   ├── auth.routes.js       # 认证路由
│   │   ├── extraction.routes.js # 提取路由
│   │   └── ...
│   ├── middlewares/             # 中间件
│   │   ├── auth.middleware.js   # 认证中间件
│   │   └── ...
│   ├── services/                # 服务
│   │   ├── extraction.service.js # 提取服务
│   │   └── ...
│   ├── utils/                   # 工具函数
│   │   └── ...
│   └── server.js                # 服务器入口
├── database/                    # 数据库相关
│   └── schema.sql               # 数据库模式
├── .env                         # 环境变量
├── .gitignore                   # Git忽略文件
├── package.json                 # 项目依赖
├── vue.config.js                # Vue配置
└── README.md                    # 项目说明
```
