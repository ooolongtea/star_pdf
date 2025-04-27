const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
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
  multipleStatements: true
};

// 创建命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 显示菜单
function showMenu() {
  console.log('\n=== 数据库管理工具 ===');
  console.log('1. 执行数据库迁移');
  console.log('2. 备份数据库');
  console.log('3. 恢复数据库');
  console.log('4. 查看数据库状态');
  console.log('5. 执行SQL查询');
  console.log('6. 清理旧数据');
  console.log('0. 退出');

  rl.question('\n请选择操作: ', (answer) => {
    switch (answer) {
      case '1':
        executeMigration();
        break;
      case '2':
        backupDatabase();
        break;
      case '3':
        restoreDatabase();
        break;
      case '4':
        showDatabaseStatus();
        break;
      case '5':
        executeQuery();
        break;
      case '6':
        cleanupOldData();
        break;
      case '0':
        console.log('再见!');
        rl.close();
        break;
      default:
        console.log('无效的选择，请重试');
        showMenu();
        break;
    }
  });
}

// 执行数据库迁移
function executeMigration() {
  console.log('\n执行数据库迁移...');

  const migrateScript = path.join(__dirname, 'migrate.js');

  exec(`node "${migrateScript}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`迁移失败: ${error.message}`);
    } else {
      console.log(stdout);
    }

    rl.question('\n按Enter键返回主菜单...', () => {
      showMenu();
    });
  });
}

// 备份数据库
function backupDatabase() {
  console.log('\n备份数据库...');

  const backupScript = path.join(__dirname, 'backup.js');

  exec(`node "${backupScript}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`备份失败: ${error.message}`);
    } else {
      console.log(stdout);
    }

    rl.question('\n按Enter键返回主菜单...', () => {
      showMenu();
    });
  });
}

// 恢复数据库
function restoreDatabase() {
  console.log('\n恢复数据库...');

  const restoreScript = path.join(__dirname, 'restore.js');

  // 使用子进程执行恢复脚本
  const child = exec(`node "${restoreScript}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`恢复失败: ${error.message}`);
    }

    rl.question('\n按Enter键返回主菜单...', () => {
      showMenu();
    });
  });

  // 将子进程的输出传递到当前进程
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  // 将当前进程的输入传递到子进程
  process.stdin.pipe(child.stdin);
}

// 查看数据库状态
async function showDatabaseStatus() {
  console.log('\n查看数据库状态...');

  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database
    });

    // 获取表信息
    const [tables] = await connection.query(`
      SELECT
        table_name,
        IFNULL(table_rows, 0) as table_rows,
        IFNULL(data_length, 0) as data_length,
        IFNULL(index_length, 0) as index_length,
        create_time,
        update_time
      FROM
        information_schema.tables
      WHERE
        table_schema = ?
      ORDER BY
        table_name
    `, [dbConfig.database]);

    // 获取数据库大小
    const [dbSize] = await connection.query(`
      SELECT
        SUM(data_length + index_length) AS total_size
      FROM
        information_schema.tables
      WHERE
        table_schema = ?
    `, [dbConfig.database]);

    // 获取最近的迁移
    const [migrations] = await connection.query(`
      SELECT name, applied_at
      FROM migrations
      ORDER BY applied_at DESC
      LIMIT 5
    `);

    // 显示数据库信息
    console.log(`\n数据库名称: ${dbConfig.database}`);
    console.log(`数据库大小: ${formatBytes(dbSize[0].total_size || 0)}`);
    console.log(`表数量: ${tables.length}`);

    // 显示表信息
    console.log('\n表信息:');
    console.log('--------------------------------------------------------------');
    console.log('表名                  行数      大小      创建时间');
    console.log('--------------------------------------------------------------');

    tables.forEach(table => {
      const size = formatBytes(parseInt(table.data_length) + parseInt(table.index_length));
      const createTime = table.create_time ? new Date(table.create_time).toLocaleString() : 'N/A';
      console.log(`${padRight(table.TABLE_NAME || table.table_name, 20)} ${padRight(table.TABLE_ROWS || table.table_rows || 0, 10)} ${padRight(size, 10)} ${createTime}`);
    });

    // 显示最近的迁移
    if (migrations.length > 0) {
      console.log('\n最近的迁移:');
      console.log('--------------------------------------------------------------');
      migrations.forEach(migration => {
        console.log(`${migration.name} (${new Date(migration.applied_at).toLocaleString()})`);
      });
    }

    // 关闭连接
    await connection.end();
  } catch (error) {
    console.error(`获取数据库状态失败: ${error.message}`);
  }

  rl.question('\n按Enter键返回主菜单...', () => {
    showMenu();
  });
}

// 执行SQL查询
function executeQuery() {
  rl.question('\n请输入SQL查询语句: ', async (query) => {
    if (!query.trim()) {
      console.log('查询语句不能为空');
      rl.question('\n按Enter键返回主菜单...', () => {
        showMenu();
      });
      return;
    }

    try {
      // 创建数据库连接
      const connection = await mysql.createConnection({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database
      });

      // 执行查询
      const [results] = await connection.query(query);

      // 显示结果
      console.log('\n查询结果:');
      console.log(JSON.stringify(results, null, 2));

      // 关闭连接
      await connection.end();
    } catch (error) {
      console.error(`查询失败: ${error.message}`);
    }

    rl.question('\n按Enter键返回主菜单...', () => {
      showMenu();
    });
  });
}

// 清理旧数据
function cleanupOldData() {
  rl.question('\n请选择要清理的数据类型:\n1. 旧的会话记录\n2. 过期的验证码\n3. 所有数据\n选择: ', async (answer) => {
    try {
      // 创建数据库连接
      const connection = await mysql.createConnection({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database
      });

      switch (answer) {
        case '1':
          // 清理旧的会话记录
          rl.question('清理多少天前的会话记录? (默认: 30): ', async (days) => {
            days = parseInt(days) || 30;

            const [result] = await connection.query(`
              DELETE FROM sessions
              WHERE expires_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            `, [days]);

            console.log(`已清理 ${result.affectedRows} 条过期会话记录`);

            await connection.end();
            rl.question('\n按Enter键返回主菜单...', () => {
              showMenu();
            });
          });
          break;

        case '2':
          // 清理过期的验证码
          const [result] = await connection.query(`
            DELETE FROM verification_codes
            WHERE expires_at < NOW()
          `);

          console.log(`已清理 ${result.affectedRows} 条过期验证码`);

          await connection.end();
          rl.question('\n按Enter键返回主菜单...', () => {
            showMenu();
          });
          break;

        case '3':
          // 清理所有数据
          rl.question('确定要清理所有数据吗? 这将删除所有表中的数据! (yes/no): ', async (confirm) => {
            if (confirm.toLowerCase() === 'yes') {
              // 获取所有表
              const [tables] = await connection.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = ?
                  AND table_name NOT IN ('migrations', 'users')
              `, [dbConfig.database]);

              // 禁用外键检查
              await connection.query('SET FOREIGN_KEY_CHECKS = 0');

              // 清空每个表
              for (const table of tables) {
                await connection.query(`TRUNCATE TABLE ${table.table_name}`);
                console.log(`已清空表: ${table.table_name}`);
              }

              // 启用外键检查
              await connection.query('SET FOREIGN_KEY_CHECKS = 1');

              console.log('所有数据已清理完成');
            } else {
              console.log('操作已取消');
            }

            await connection.end();
            rl.question('\n按Enter键返回主菜单...', () => {
              showMenu();
            });
          });
          break;

        default:
          console.log('无效的选择');
          await connection.end();
          rl.question('\n按Enter键返回主菜单...', () => {
            showMenu();
          });
          break;
      }
    } catch (error) {
      console.error(`清理数据失败: ${error.message}`);
      rl.question('\n按Enter键返回主菜单...', () => {
        showMenu();
      });
    }
  });
}

// 格式化字节大小
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// 右填充字符串
function padRight(str, length) {
  return String(str).padEnd(length);
}

// 检查命令行参数
const args = process.argv.slice(2);

if (args.length > 0) {
  // 命令行模式
  const command = args[0];

  switch (command) {
    case 'migrate':
      executeMigration(true);
      break;
    case 'backup':
      backupDatabase(true);
      break;
    case 'restore':
      const backupFile = args[1];
      if (backupFile) {
        // 直接恢复指定的备份文件
        const restoreScript = path.join(__dirname, 'restore.js');
        exec(`node "${restoreScript}" "${backupFile}"`, (error, stdout, stderr) => {
          if (error) {
            console.error(`恢复失败: ${error.message}`);
            process.exit(1);
          }
          console.log(stdout);
          process.exit(0);
        });
      } else {
        restoreDatabase(true);
      }
      break;
    case 'status':
      showDatabaseStatus(true);
      break;
    case 'query':
      if (args.length > 1) {
        const query = args.slice(1).join(' ');
        executeQueryDirect(query);
      } else {
        console.error('缺少查询语句');
        process.exit(1);
      }
      break;
    case 'cleanup':
      const type = args[1] || 'all';
      cleanupDirectly(type);
      break;
    case 'help':
      showHelp();
      break;
    default:
      console.error(`未知命令: ${command}`);
      showHelp();
      process.exit(1);
  }
} else {
  // 交互式模式
  showMenu();
}

// 显示帮助信息
function showHelp() {
  console.log(`
数据库管理工具

交互式模式:
  node database/db-manager.js

命令行模式:
  node database/db-manager.js [命令] [选项]

命令:
  migrate           执行数据库迁移
  backup            备份数据库
  restore [文件名]   从备份恢复数据库
  status            查看数据库状态
  query [SQL]       执行SQL查询
  cleanup [类型]     清理旧数据 (类型: sessions, codes, all)
  help              显示帮助信息

示例:
  node database/db-manager.js migrate
  node database/db-manager.js backup
  node database/db-manager.js restore backup_20240601.sql
  node database/db-manager.js status
  node database/db-manager.js query "SELECT * FROM users LIMIT 5"
  node database/db-manager.js cleanup sessions
  `);
}

// 执行数据库迁移（命令行模式）
function executeMigration(exitAfter = false) {
  console.log('\n执行数据库迁移...');

  const migrateScript = path.join(__dirname, 'migrate.js');

  exec(`node "${migrateScript}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`迁移失败: ${error.message}`);
      if (exitAfter) process.exit(1);
    } else {
      console.log(stdout);
      if (exitAfter) process.exit(0);
    }

    if (!exitAfter) {
      rl.question('\n按Enter键返回主菜单...', () => {
        showMenu();
      });
    }
  });
}

// 备份数据库（命令行模式）
function backupDatabase(exitAfter = false) {
  console.log('\n备份数据库...');

  const backupScript = path.join(__dirname, 'backup.js');

  exec(`node "${backupScript}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`备份失败: ${error.message}`);
      if (exitAfter) process.exit(1);
    } else {
      console.log(stdout);
      if (exitAfter) process.exit(0);
    }

    if (!exitAfter) {
      rl.question('\n按Enter键返回主菜单...', () => {
        showMenu();
      });
    }
  });
}

// 恢复数据库（命令行模式）
function restoreDatabase(exitAfter = false) {
  console.log('\n恢复数据库...');

  const restoreScript = path.join(__dirname, 'restore.js');

  // 使用子进程执行恢复脚本
  const child = exec(`node "${restoreScript}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`恢复失败: ${error.message}`);
      if (exitAfter) process.exit(1);
    }

    if (!exitAfter) {
      rl.question('\n按Enter键返回主菜单...', () => {
        showMenu();
      });
    } else {
      process.exit(0);
    }
  });

  // 将子进程的输出传递到当前进程
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  // 将当前进程的输入传递到子进程
  process.stdin.pipe(child.stdin);
}

// 查看数据库状态（命令行模式）
async function showDatabaseStatus(exitAfter = false) {
  console.log('\n查看数据库状态...');

  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database
    });

    // 获取表信息
    const [tables] = await connection.query(`
      SELECT
        table_name,
        IFNULL(table_rows, 0) as table_rows,
        IFNULL(data_length, 0) as data_length,
        IFNULL(index_length, 0) as index_length,
        create_time,
        update_time
      FROM
        information_schema.tables
      WHERE
        table_schema = ?
      ORDER BY
        table_name
    `, [dbConfig.database]);

    // 获取数据库大小
    const [dbSize] = await connection.query(`
      SELECT
        SUM(data_length + index_length) AS total_size
      FROM
        information_schema.tables
      WHERE
        table_schema = ?
    `, [dbConfig.database]);

    // 获取最近的迁移
    const [migrations] = await connection.query(`
      SELECT name, applied_at
      FROM migrations
      ORDER BY applied_at DESC
      LIMIT 5
    `);

    // 显示数据库信息
    console.log(`\n数据库名称: ${dbConfig.database}`);
    console.log(`数据库大小: ${formatBytes(dbSize[0].total_size || 0)}`);
    console.log(`表数量: ${tables.length}`);

    // 显示表信息
    console.log('\n表信息:');
    console.log('--------------------------------------------------------------');
    console.log('表名                  行数      大小      创建时间');
    console.log('--------------------------------------------------------------');

    tables.forEach(table => {
      const size = formatBytes(parseInt(table.data_length) + parseInt(table.index_length));
      const createTime = table.create_time ? new Date(table.create_time).toLocaleString() : 'N/A';
      console.log(`${padRight(table.TABLE_NAME || table.table_name, 20)} ${padRight(table.TABLE_ROWS || table.table_rows || 0, 10)} ${padRight(size, 10)} ${createTime}`);
    });

    // 显示最近的迁移
    if (migrations.length > 0) {
      console.log('\n最近的迁移:');
      console.log('--------------------------------------------------------------');
      migrations.forEach(migration => {
        console.log(`${migration.name} (${new Date(migration.applied_at).toLocaleString()})`);
      });
    }

    // 关闭连接
    await connection.end();

    if (exitAfter) {
      process.exit(0);
    }
  } catch (error) {
    console.error(`获取数据库状态失败: ${error.message}`);
    if (exitAfter) {
      process.exit(1);
    }
  }

  if (!exitAfter) {
    rl.question('\n按Enter键返回主菜单...', () => {
      showMenu();
    });
  }
}

// 直接执行SQL查询（命令行模式）
async function executeQueryDirect(query) {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database
    });

    // 执行查询
    const [results] = await connection.query(query);

    // 显示结果
    console.log('\n查询结果:');
    console.log(JSON.stringify(results, null, 2));

    // 关闭连接
    await connection.end();

    process.exit(0);
  } catch (error) {
    console.error(`查询失败: ${error.message}`);
    process.exit(1);
  }
}

// 直接清理数据（命令行模式）
async function cleanupDirectly(type) {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database
    });

    switch (type) {
      case 'sessions':
        // 清理旧的会话记录
        const [sessionResult] = await connection.query(`
          DELETE FROM sessions
          WHERE expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);

        console.log(`已清理 ${sessionResult.affectedRows} 条过期会话记录`);
        break;

      case 'codes':
        // 清理过期的验证码
        const [codeResult] = await connection.query(`
          DELETE FROM verification_codes
          WHERE expires_at < NOW()
        `);

        console.log(`已清理 ${codeResult.affectedRows} 条过期验证码`);
        break;

      case 'all':
        // 清理所有过期数据
        const [sessionResult2] = await connection.query(`
          DELETE FROM sessions
          WHERE expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);

        const [codeResult2] = await connection.query(`
          DELETE FROM verification_codes
          WHERE expires_at < NOW()
        `);

        console.log(`已清理 ${sessionResult2.affectedRows} 条过期会话记录`);
        console.log(`已清理 ${codeResult2.affectedRows} 条过期验证码`);
        break;

      default:
        console.error(`未知的清理类型: ${type}`);
        await connection.end();
        process.exit(1);
    }

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error(`清理数据失败: ${error.message}`);
    process.exit(1);
  }
}
