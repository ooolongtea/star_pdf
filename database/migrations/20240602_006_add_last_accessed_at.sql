-- 添加last_accessed_at字段并为所有字段添加注释

-- 添加last_accessed_at字段
ALTER TABLE pdf_files
ADD COLUMN last_accessed_at TIMESTAMP NULL COMMENT '最后访问时间' AFTER last_downloaded_at;

-- 为现有字段添加注释
ALTER TABLE pdf_files
MODIFY COLUMN results_dir VARCHAR(255) COMMENT '结果文件目录路径',
MODIFY COLUMN results_size BIGINT DEFAULT 0 COMMENT '结果文件总大小(字节)',
MODIFY COLUMN expires_at TIMESTAMP NULL COMMENT '结果过期时间',
MODIFY COLUMN download_count INT DEFAULT 0 COMMENT '下载次数',
MODIFY COLUMN last_downloaded_at TIMESTAMP NULL COMMENT '最后下载时间';
