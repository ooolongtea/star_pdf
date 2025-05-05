-- 添加optimized_markdown_path字段到pdf_files表

-- 检查列是否存在，如果不存在则添加
SET @dbname = DATABASE();
SET @tablename = "pdf_files";
SET @columnname = "optimized_markdown_path";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname) AND
      (TABLE_NAME = @tablename) AND
      (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(255) COMMENT '优化后的Markdown文件路径' AFTER markdown_path;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 更新已有记录的optimized_markdown_path字段为NULL
UPDATE pdf_files SET optimized_markdown_path = NULL WHERE optimized_markdown_path IS NULL;
