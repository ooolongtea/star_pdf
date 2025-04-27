# 数据库管理工具使用指南

本文档介绍如何使用数据库管理工具来执行数据库迁移、备份、恢复等操作。

## 工具概述

数据库管理工具提供了以下功能：

1. **数据库迁移**：应用数据库结构变更
2. **数据库备份**：创建数据库备份
3. **数据库恢复**：从备份恢复数据库
4. **数据库状态查看**：查看数据库表结构和数据量
5. **SQL查询执行**：执行自定义SQL查询
6. **数据清理**：清理过期数据

## 使用方式

数据库管理工具支持两种使用方式：

### 1. 交互式模式

在交互式模式下，工具会显示一个菜单，让您选择要执行的操作。

```bash
node database/db-manager.js
```

### 2. 命令行模式

在命令行模式下，您可以直接指定要执行的操作和参数。

```bash
node database/db-manager.js [命令] [选项]
```

## 命令参考

### 执行数据库迁移

应用所有未执行的迁移脚本。

```bash
node database/db-manager.js migrate
```

或者使用简化的迁移脚本：

```bash
node database/run-migration.js
```

### 备份数据库

创建数据库的备份。

```bash
node database/db-manager.js backup
```

### 恢复数据库

从备份恢复数据库。

```bash
# 交互式选择备份文件
node database/db-manager.js restore

# 指定备份文件
node database/db-manager.js restore backup_20240601.sql
```

### 查看数据库状态

显示数据库表结构和数据量。

```bash
node database/db-manager.js status
```

### 执行SQL查询

执行自定义SQL查询。

```bash
node database/db-manager.js query "SELECT * FROM users LIMIT 5"
```

### 清理过期数据

清理过期的会话记录和验证码。

```bash
# 清理所有过期数据
node database/db-manager.js cleanup all

# 只清理过期会话
node database/db-manager.js cleanup sessions

# 只清理过期验证码
node database/db-manager.js cleanup codes
```

## PDF结果持久化存储迁移

为了支持完整下载和持久化存储PDF转换结果，我们对数据库结构进行了以下增强：

1. 添加了新的字段：
   - `results_dir`: 结果文件目录路径
   - `results_size`: 结果文件总大小(字节)
   - `expires_at`: 结果过期时间
   - `download_count`: 下载次数
   - `last_downloaded_at`: 最后下载时间
   - `last_accessed_at`: 最后访问时间

2. 添加了索引以提高查询性能：
   - `idx_pdf_files_expires_at`: 用于快速查询过期文件
   - `idx_pdf_files_user_id_status`: 用于快速查询用户文件

这些更改分布在两个迁移文件中：

1. `20240601_005_enhance_pdf_files.sql`: 添加主要字段和索引
2. `20240602_006_add_last_accessed_at.sql`: 添加最后访问时间字段和字段注释

要应用这些迁移，请执行：

```bash
node database/db-manager.js migrate
```

## 注意事项

- 迁移是增量的，只会应用尚未应用的迁移文件
- 迁移过程中不会删除现有数据
- 备份会自动保留最近的10个备份文件
- 在执行数据库恢复前，请确保已备份重要数据
