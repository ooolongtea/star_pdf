/**
 * 测试AI总结轮询进度功能
 */

const axios = require('axios');

// 配置
const BASE_URL = 'http://localhost:3000';
const FILE_ID = 'your-file-id-here'; // 替换为实际的文件ID
const AUTH_TOKEN = 'your-auth-token-here'; // 替换为实际的认证令牌

// 创建axios实例
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// 启动总结生成
async function startSummaryGeneration() {
  try {
    console.log('启动总结生成...');
    const response = await api.post(`/api/pdf/files/${FILE_ID}/summary`);
    
    if (response.data.success) {
      console.log('总结生成已启动:', response.data.message);
      console.log('进度查询URL:', response.data.data.progressUrl);
      return true;
    } else {
      console.error('启动失败:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('启动总结生成错误:', error.response?.data || error.message);
    return false;
  }
}

// 轮询进度
async function pollProgress() {
  let attempts = 0;
  const maxAttempts = 150; // 最多轮询5分钟（每2秒一次）
  
  while (attempts < maxAttempts) {
    try {
      console.log(`\n第 ${attempts + 1} 次查询进度...`);
      const response = await api.get(`/api/pdf/files/${FILE_ID}/summary/progress`);
      
      if (response.data.success) {
        const progress = response.data.data;
        console.log(`状态: ${progress.status}`);
        console.log(`进度: ${progress.progress}%`);
        console.log(`消息: ${progress.message}`);
        
        if (progress.completed) {
          console.log('\n✅ 总结生成完成!');
          if (progress.result) {
            console.log('总结内容长度:', progress.result.content.length);
            console.log('保存路径:', progress.result.summaryPath);
          }
          return true;
        }
        
        if (progress.status === 'error') {
          console.log('\n❌ 总结生成失败:', progress.error);
          return false;
        }
      } else {
        console.log('查询进度失败:', response.data.message);
      }
      
      // 等待2秒后继续轮询
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
    } catch (error) {
      console.error('查询进度错误:', error.response?.data || error.message);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n⏰ 轮询超时');
  return false;
}

// 获取最终结果
async function getFinalResult() {
  try {
    console.log('\n获取最终总结内容...');
    const response = await api.get(`/api/pdf/files/${FILE_ID}/summary`);
    
    if (response.data.success) {
      console.log('✅ 成功获取总结内容');
      console.log('内容长度:', response.data.data.length);
      console.log('内容预览:', response.data.data.substring(0, 200) + '...');
      return true;
    } else {
      console.log('❌ 获取总结内容失败:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('获取总结内容错误:', error.response?.data || error.message);
    return false;
  }
}

// 主测试函数
async function testSummaryProgress() {
  console.log('🚀 开始测试AI总结轮询进度功能\n');
  
  // 1. 启动总结生成
  const started = await startSummaryGeneration();
  if (!started) {
    console.log('❌ 测试失败：无法启动总结生成');
    return;
  }
  
  // 2. 轮询进度
  const completed = await pollProgress();
  if (!completed) {
    console.log('❌ 测试失败：总结生成未完成');
    return;
  }
  
  // 3. 获取最终结果
  const result = await getFinalResult();
  if (result) {
    console.log('\n🎉 测试成功：AI总结轮询进度功能正常工作！');
  } else {
    console.log('\n❌ 测试失败：无法获取最终结果');
  }
}

// 运行测试
if (require.main === module) {
  // 检查配置
  if (FILE_ID === 'your-file-id-here' || AUTH_TOKEN === 'your-auth-token-here') {
    console.log('❌ 请先配置 FILE_ID 和 AUTH_TOKEN');
    process.exit(1);
  }
  
  testSummaryProgress().catch(console.error);
}

module.exports = {
  testSummaryProgress,
  startSummaryGeneration,
  pollProgress,
  getFinalResult
};
