const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'patent_extractor',
  multipleStatements: true // 允许执行多条SQL语句
};

// 迁移目录
const migrationsDir = path.join(__dirname, 'migrations');

// 执行迁移
async function migrate() {
  let connection;

  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      multipleStatements: true
    });

    // 确保数据库存在
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await connection.query(`USE ${dbConfig.database}`);

    // 确保迁移表存在
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 获取已应用的迁移
    const [appliedMigrations] = await connection.query('SELECT name FROM migrations');
    const appliedMigrationNames = appliedMigrations.map(m => m.name);

    // 获取所有迁移文件
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // 按文件名排序

    // 执行尚未应用的迁移
    for (const file of migrationFiles) {
      if (!appliedMigrationNames.includes(file)) {
        console.log(`正在应用迁移: ${file}`);

        // 读取迁移文件内容
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        try {
          // 执行迁移
          await connection.query(sql);

          // 记录迁移已应用
          await connection.query('INSERT INTO migrations (name) VALUES (?)', [file]);

          console.log(`迁移已应用: ${file}`);
        } catch (error) {
          // 检查是否为表已存在错误
          if (error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log(`表已存在，继续执行: ${error.message}`);
            // 记录迁移已应用，即使有错误
            await connection.query('INSERT INTO migrations (name) VALUES (?)', [file]);
          } else if (error.code === 'ER_DUP_ENTRY') {
            console.log(`重复数据项，继续执行: ${error.message}`);
            // 记录迁移已应用，即使有错误
            await connection.query('INSERT INTO migrations (name) VALUES (?)', [file]);
          } else {
            // 其他错误则抛出
            throw error;
          }
        }
      } else {
        console.log(`迁移已存在，跳过: ${file}`);
      }
    }

    console.log('所有迁移已成功应用');
  } catch (error) {
    console.error('迁移过程中出错:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行迁移
migrate();
