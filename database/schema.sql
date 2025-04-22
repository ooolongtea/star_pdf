-- 文献专利化学式提取系统数据库设计

-- 创建数据库
CREATE DATABASE IF NOT EXISTS patent_extractor;
USE patent_extractor;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    avatar VARCHAR(255),
    role ENUM('admin', 'user') DEFAULT 'user',
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 专利文档表
CREATE TABLE IF NOT EXISTS patents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    patent_number VARCHAR(50),
    description TEXT,
    file_path VARCHAR(255) NOT NULL,
    file_size INT,
    file_type VARCHAR(20),
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 化学式表
CREATE TABLE IF NOT EXISTS molecules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patent_id INT NOT NULL,
    image_id VARCHAR(100) NOT NULL,
    compound_smiles TEXT,
    compound_name VARCHAR(255),
    coref VARCHAR(100),
    inchi TEXT,
    inchi_key VARCHAR(100),
    confidence FLOAT,
    page_number INT,
    image_path VARCHAR(255),
    visualization_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patent_id) REFERENCES patents(id) ON DELETE CASCADE
);

-- 反应表
CREATE TABLE IF NOT EXISTS reactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patent_id INT NOT NULL,
    image_id VARCHAR(100) NOT NULL,
    reactants_smiles TEXT,
    product_smiles TEXT,
    product_coref VARCHAR(100),
    conditions TEXT,
    image_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patent_id) REFERENCES patents(id) ON DELETE CASCADE
);

-- 处理任务表
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    patent_id INT NOT NULL,
    task_id VARCHAR(100) NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
    progress FLOAT DEFAULT 0,
    message TEXT,
    error TEXT,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (patent_id) REFERENCES patents(id) ON DELETE CASCADE
);

-- 验证码表
CREATE TABLE IF NOT EXISTS verification_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (email, code)
);

-- 用户会话表
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 系统设置表
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    server_url VARCHAR(255) DEFAULT 'http://localhost:8080',
    remote_mode BOOLEAN DEFAULT FALSE,
    username VARCHAR(50),
    password VARCHAR(255),
    default_output_dir VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建初始管理员用户 (密码: admin123)
INSERT INTO users (username, email, password, full_name, role)
VALUES ('admin', 'admin@example.com', '$2a$10$XFE0rQyOjOY5.ZKHSWUlYOaK4z5r5eLYxgXmGSiYZy7XZ5hGMdFTK', 'System Administrator', 'admin');
