# PDF结果持久化存储迁移说明

## 迁移概述

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

## 迁移文件

这些更改分布在两个迁移文件中：

1. `20240601_005_enhance_pdf_files.sql`: 添加主要字段和索引
2. `20240602_006_add_last_accessed_at.sql`: 添加最后访问时间字段和字段注释

## 执行迁移

要应用这些迁移，请执行以下命令：

```bash
node database/run_migration.js
```

或者直接执行：

```bash
node database/migrate.js
```

## 验证迁移

迁移成功后，可以通过以下SQL查询验证表结构：

```sql
DESCRIBE pdf_files;
SHOW INDEX FROM pdf_files;
```

## 注意事项

- 迁移是增量的，只会应用尚未应用的迁移文件
- 迁移过程中不会删除现有数据
- 如果迁移失败，请检查错误日志并修复问题后重新执行
