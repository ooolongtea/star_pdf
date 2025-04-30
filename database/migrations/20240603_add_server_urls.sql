-- 添加服务器URL字段到settings表
ALTER TABLE settings 
ADD COLUMN mineru_server_url VARCHAR(255) DEFAULT 'http://172.19.1.81:8010',
ADD COLUMN chemical_extraction_server_url VARCHAR(255) DEFAULT 'http://172.19.1.81:8011';

-- 更新现有记录
UPDATE settings 
SET mineru_server_url = 'http://172.19.1.81:8010',
    chemical_extraction_server_url = 'http://172.19.1.81:8011';
