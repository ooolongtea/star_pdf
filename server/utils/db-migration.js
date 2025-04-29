/**
 * 数据库迁移脚本
 * 用于添加图片相关的字段
 */
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 创建数据库连接
async function connectToDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'patent_extractor'
    });

    console.log('数据库连接成功');
    return connection;
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw error;
  }
}

// 检查字段是否存在
async function checkColumnExists(connection, table, column) {
  try {
    const [rows] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    `, [table, column]);

    return rows.length > 0;
  } catch (error) {
    console.error(`检查字段 ${table}.${column} 失败:`, error);
    throw error;
  }
}

// 添加图片URL字段
async function addImageUrlColumn(connection) {
  try {
    const columnExists = await checkColumnExists(connection, 'messages', 'image_url');

    if (!columnExists) {
      await connection.execute(`
        ALTER TABLE messages
        ADD COLUMN image_url VARCHAR(255) NULL
        COMMENT '用户上传的图片URL'
      `);
      console.log('添加 image_url 字段成功');
    } else {
      console.log('image_url 字段已存在');
    }
  } catch (error) {
    console.error('添加 image_url 字段失败:', error);
    throw error;
  }
}

// 添加图片URLs字段（用于AI生成的多张图片）
async function addImageUrlsColumn(connection) {
  try {
    const columnExists = await checkColumnExists(connection, 'messages', 'image_urls');

    if (!columnExists) {
      await connection.execute(`
        ALTER TABLE messages
        ADD COLUMN image_urls TEXT NULL
        COMMENT 'AI生成的图片URLs，JSON数组格式'
      `);
      console.log('添加 image_urls 字段成功');
    } else {
      console.log('image_urls 字段已存在');
    }
  } catch (error) {
    console.error('添加 image_urls 字段失败:', error);
    throw error;
  }
}

// 添加思维链字段
async function addThoughtChainColumn(connection) {
  try {
    const columnExists = await checkColumnExists(connection, 'messages', 'thought_chain');

    if (!columnExists) {
      await connection.execute(`
        ALTER TABLE messages
        ADD COLUMN thought_chain TEXT NULL
        COMMENT 'AI的思维链过程'
      `);
      console.log('添加 thought_chain 字段成功');
    } else {
      console.log('thought_chain 字段已存在');
    }
  } catch (error) {
    console.error('添加 thought_chain 字段失败:', error);
    throw error;
  }
}

// 主函数
async function main() {
  let connection;

  try {
    connection = await connectToDatabase();

    // 添加图片URL字段
    await addImageUrlColumn(connection);

    // 添加图片URLs字段
    await addImageUrlsColumn(connection);

    console.log('数据库迁移完成');
  } catch (error) {
    console.error('数据库迁移失败:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 执行主函数
main();
