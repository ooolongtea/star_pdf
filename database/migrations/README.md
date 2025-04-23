# 数据库迁移

本目录包含数据库迁移脚本，按照时间顺序命名和执行。

## 迁移文件命名规则

迁移文件按照以下格式命名：`YYYYMMDD_序号_描述.sql`

例如：
- `20230101_001_initial_schema.sql`
- `20230215_002_add_api_keys_table.sql`
- `20230320_003_add_chat_tables.sql`

## 执行迁移

使用 `migrate.js` 脚本执行迁移：

```bash
node database/migrate.js
```

这将按照文件名顺序执行所有尚未应用的迁移。
