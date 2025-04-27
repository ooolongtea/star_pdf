/**
 * 数据库迁移执行脚本
 * 
 * 使用方法：
 * node database/run-migration.js
 * 
 * 该脚本会执行所有未应用的迁移文件
 */

const { exec } = require('child_process');
const path = require('path');

// 迁移脚本路径
const migrateScript = path.join(__dirname, 'migrate.js');

// 执行迁移
console.log('开始执行数据库迁移...');

const migrate = exec(`node "${migrateScript}"`, {
  stdio: 'inherit' // 将子进程的输出直接传递到父进程
});

migrate.stdout.on('data', (data) => {
  console.log(data.toString());
});

migrate.stderr.on('data', (data) => {
  console.error(data.toString());
});

migrate.on('close', (code) => {
  if (code === 0) {
    console.log('数据库迁移成功完成');
  } else {
    console.error(`数据库迁移失败，退出码: ${code}`);
    process.exit(1);
  }
});
