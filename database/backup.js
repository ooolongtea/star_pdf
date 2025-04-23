const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'patent_extractor'
};

// 备份目录
const backupDir = path.join(__dirname, 'backups');

// 确保备份目录存在
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// 生成备份文件名
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFileName = `${dbConfig.database}_${timestamp}.sql`;
const backupFilePath = path.join(backupDir, backupFileName);

// 构建mysqldump命令
const mysqldumpCmd = `mysqldump --host=${dbConfig.host} --user=${dbConfig.user}${dbConfig.password ? ` --password=${dbConfig.password}` : ''} ${dbConfig.database} > "${backupFilePath}"`;

// 执行备份
console.log(`正在备份数据库 ${dbConfig.database} 到 ${backupFilePath}`);
exec(mysqldumpCmd, (error, stdout, stderr) => {
  if (error) {
    console.error(`备份失败: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`备份警告: ${stderr}`);
    return;
  }
  console.log(`数据库备份成功: ${backupFilePath}`);
  
  // 列出所有备份文件并按修改时间排序
  const backupFiles = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.sql'))
    .map(file => {
      const filePath = path.join(backupDir, file);
      return {
        name: file,
        path: filePath,
        mtime: fs.statSync(filePath).mtime
      };
    })
    .sort((a, b) => b.mtime - a.mtime);
  
  console.log('\n最近的5个备份:');
  backupFiles.slice(0, 5).forEach((file, index) => {
    console.log(`${index + 1}. ${file.name} (${file.mtime.toLocaleString()})`);
  });
  
  // 保留最近的10个备份，删除旧的备份
  if (backupFiles.length > 10) {
    console.log('\n删除旧备份:');
    backupFiles.slice(10).forEach(file => {
      fs.unlinkSync(file.path);
      console.log(`已删除: ${file.name}`);
    });
  }
});
