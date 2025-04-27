-- 增强pdf_files表，添加更多字段存储处理结果信息

-- 添加新字段
ALTER TABLE pdf_files
ADD COLUMN results_dir VARCHAR(255) AFTER formulas_path,
ADD COLUMN results_size BIGINT DEFAULT 0 AFTER results_dir,
ADD COLUMN expires_at TIMESTAMP NULL AFTER results_size,
ADD COLUMN download_count INT DEFAULT 0 AFTER expires_at,
ADD COLUMN last_downloaded_at TIMESTAMP NULL AFTER download_count;

-- 添加索引
CREATE INDEX idx_pdf_files_expires_at ON pdf_files(expires_at);
CREATE INDEX idx_pdf_files_user_id_status ON pdf_files(user_id, status);
