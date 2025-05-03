-- 添加reaction_id字段到reactions表
ALTER TABLE reactions ADD COLUMN reaction_id INT DEFAULT NULL AFTER image_id;

-- 添加索引以提高查询性能
CREATE INDEX idx_reactions_reaction_id ON reactions(reaction_id);
