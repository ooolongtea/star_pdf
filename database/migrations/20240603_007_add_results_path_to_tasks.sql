-- 添加results_path列到tasks表
ALTER TABLE tasks
ADD COLUMN results_path VARCHAR(255) NULL COMMENT '结果文件路径';
