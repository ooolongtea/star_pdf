-- 添加provider_id列到api_keys表

-- 检查列是否存在，如果不存在则添加
SET @dbname = DATABASE();
SET @tablename = "api_keys";
SET @columnname = "provider_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname) AND
      (TABLE_NAME = @tablename) AND
      (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(50) COMMENT '提供商ID' AFTER model_name;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 更新现有记录的provider_id字段
-- 根据model_name字段推断provider_id
UPDATE api_keys SET provider_id = 
  CASE 
    WHEN model_name LIKE '%qwen%' OR model_name LIKE '%qwq%' THEN 'qwen'
    WHEN model_name LIKE '%deepseek%' THEN 'deepseek'
    WHEN model_name LIKE '%baichuan%' THEN 'baichuan'
    WHEN model_name LIKE '%chatglm%' THEN 'chatglm'
    ELSE model_name -- 如果无法推断，则使用model_name作为provider_id
  END
WHERE provider_id IS NULL;

-- 添加注释到其他字段
ALTER TABLE api_keys
MODIFY COLUMN model_name VARCHAR(50) NOT NULL COMMENT '模型名称',
MODIFY COLUMN api_key VARCHAR(255) NOT NULL COMMENT 'API密钥',
MODIFY COLUMN api_base_url VARCHAR(255) COMMENT 'API基础URL',
MODIFY COLUMN is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活';
