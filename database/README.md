# 数据库管理

本目录包含数据库相关的脚本和文件，用于管理专利化学式提取系统的数据库。

## 目录结构

- `schema.sql` - 主数据库结构
- `api_keys.sql` - API密钥表结构
- `chat_tables.sql` - 聊天相关表结构
- `migrations/` - 数据库迁移脚本
- `backups/` - 数据库备份文件
- `migrate.js` - 数据库迁移执行脚本
- `backup.js` - 数据库备份脚本
- `restore.js` - 数据库恢复脚本

## 数据库管理流程

### 初始化数据库

首次设置数据库时，可以使用迁移系统自动创建所有表结构：

```bash
node database/migrate.js
```

这将按照时间顺序执行所有迁移脚本，创建必要的表结构。

### 数据库迁移

当需要对数据库结构进行更改时，应创建新的迁移脚本：

1. 在 `migrations` 目录中创建新的迁移文件，按照命名规则：`YYYYMMDD_序号_描述.sql`
2. 在迁移文件中编写SQL语句
3. 执行迁移：`node database/migrate.js`

### 数据库备份

定期备份数据库是良好的实践，可以使用备份脚本：

```bash
node database/backup.js
```

这将创建一个时间戳命名的备份文件，并保留最近的10个备份。

### 数据库恢复

如果需要从备份恢复数据库：

```bash
node database/restore.js
```

按照提示选择要恢复的备份文件。

## 数据库表结构

### 用户相关表

- `users` - 用户信息
- `sessions` - 用户会话
- `verification_codes` - 验证码
- `settings` - 用户设置

### 专利相关表

- `patents` - 专利文档
- `molecules` - 化学式
- `reactions` - 反应
- `tasks` - 处理任务

### API密钥表

- `api_keys` - 用户API密钥

### 聊天相关表

- `conversations` - 对话
- `messages` - 消息

## 数据库配置

数据库连接配置在 `.env` 文件中设置：

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=patent_extractor
```
