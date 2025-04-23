const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
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
  console.error(`备份目录不存在: ${backupDir}`);
  process.exit(1);
}

// 获取所有备份文件
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
  .sort((a, b) => b.mtime - a.mtime); // 按修改时间降序排序

if (backupFiles.length === 0) {
  console.error('没有找到备份文件');
  process.exit(1);
}

// 显示备份文件列表
console.log('可用的备份文件:');
backupFiles.forEach((file, index) => {
  console.log(`${index + 1}. ${file.name} (${file.mtime.toLocaleString()})`);
});

// 创建命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 询问用户选择哪个备份文件
rl.question('\n请选择要恢复的备份文件编号: ', (answer) => {
  const index = parseInt(answer) - 1;
  
  if (isNaN(index) || index < 0 || index >= backupFiles.length) {
    console.error('无效的选择');
    rl.close();
    process.exit(1);
  }
  
  const selectedBackup = backupFiles[index];
  
  // 确认恢复操作
  rl.question(`\n确定要恢复数据库 ${dbConfig.database} 从备份 ${selectedBackup.name}? 这将覆盖当前数据库内容! (y/n): `, (confirm) => {
    if (confirm.toLowerCase() !== 'y') {
      console.log('操作已取消');
      rl.close();
      return;
    }
    
    // 构建mysql恢复命令
    const mysqlCmd = `mysql --host=${dbConfig.host} --user=${dbConfig.user}${dbConfig.password ? ` --password=${dbConfig.password}` : ''} ${dbConfig.database} < "${selectedBackup.path}"`;
    
    console.log(`\n正在从 ${selectedBackup.path} 恢复数据库 ${dbConfig.database}...`);
    
    // 执行恢复
    exec(mysqlCmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`恢复失败: ${error.message}`);
        rl.close();
        return;
      }
      
      if (stderr) {
        console.error(`恢复警告: ${stderr}`);
      }
      
      console.log(`数据库恢复成功!`);
      rl.close();
    });
  });
});
