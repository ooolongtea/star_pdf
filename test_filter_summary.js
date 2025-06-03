/**
 * 测试总结内容过滤功能
 */

const fs = require('fs');
const path = require('path');

// 过滤AI总结内容，去除模板说明和要求
function filterSummaryContent(content) {
  if (!content) return '';
  
  // 按行分割内容
  const lines = content.split('\n');
  const filteredLines = [];
  let skipSection = false;
  let inRequirementSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 检查是否遇到分隔线，开始跳过注意事项部分
    if (trimmedLine === '---' || trimmedLine === '--- ') {
      skipSection = true;
      continue;
    }

    // 如果已经在跳过状态，继续跳过
    if (skipSection) {
      continue;
    }

    // 检查是否是要求部分的开始
    if (trimmedLine === '**要求：**') {
      inRequirementSection = true;
      continue;
    }

    // 如果在要求部分中
    if (inRequirementSection) {
      // 检查是否是新的章节开始（以##开头），结束要求部分
      if (trimmedLine.startsWith('## ')) {
        inRequirementSection = false;
        filteredLines.push(line);
      }
      // 跳过要求部分的内容
      continue;
    }

    // 跳过以"**要求："开头的行
    if (trimmedLine.startsWith('**要求：')) {
      continue;
    }

    // 跳过注意事项相关的行
    if (trimmedLine === '**注意事项：**' || 
        trimmedLine.startsWith('1. 请将') ||
        trimmedLine.startsWith('2. 带*的字段') ||
        trimmedLine.startsWith('3. 保持原文') ||
        trimmedLine.startsWith('4. 对于化学') ||
        trimmedLine.startsWith('5. 所有日期') ||
        trimmedLine.startsWith('6. 所有编号') ||
        trimmedLine.startsWith('7. 避免使用') ||
        trimmedLine.startsWith('8. 保持专业')) {
      continue;
    }

    // 保留这一行
    filteredLines.push(line);
  }

  // 重新组合内容
  let filteredContent = filteredLines.join('\n');

  // 移除多余的空行（连续的空行合并为单个空行）
  filteredContent = filteredContent.replace(/\n\s*\n\s*\n/g, '\n\n');

  // 移除开头和结尾的空行
  filteredContent = filteredContent.trim();

  return filteredContent;
}

// 测试函数
function testFilterFunction() {
  console.log('🧪 开始测试总结内容过滤功能\n');

  // 测试文件路径
  const testFilePath = 'uploads/results/075b5ec0-54c4-4a3b-8347-77cbceb18a0f/auto/summary/25541300-c612-4e68-8768-e40d22443516_summary.md';
  
  if (!fs.existsSync(testFilePath)) {
    console.log('❌ 测试文件不存在:', testFilePath);
    console.log('请提供一个有效的总结文件路径进行测试');
    return;
  }

  try {
    // 读取原始内容
    const originalContent = fs.readFileSync(testFilePath, 'utf8');
    console.log('📄 原始文件:', testFilePath);
    console.log('📏 原始内容长度:', originalContent.length, '字符');
    console.log('📝 原始内容行数:', originalContent.split('\n').length, '行');
    
    // 过滤内容
    const filteredContent = filterSummaryContent(originalContent);
    console.log('\n✨ 过滤后内容长度:', filteredContent.length, '字符');
    console.log('📝 过滤后内容行数:', filteredContent.split('\n').length, '行');
    
    // 计算过滤比例
    const reductionPercentage = ((originalContent.length - filteredContent.length) / originalContent.length * 100).toFixed(1);
    console.log('📉 内容减少:', reductionPercentage + '%');
    
    // 保存过滤后的内容到新文件
    const outputPath = testFilePath.replace('.md', '_filtered.md');
    fs.writeFileSync(outputPath, filteredContent);
    console.log('\n💾 过滤后内容已保存到:', outputPath);
    
    // 显示过滤前后的对比
    console.log('\n📊 过滤效果对比:');
    console.log('=' * 50);
    
    // 检查是否还包含模板说明
    const hasRequirements = filteredContent.includes('**要求：**');
    const hasNotes = filteredContent.includes('**注意事项：**');
    const hasSeparator = filteredContent.includes('---');
    
    console.log('✅ 是否移除"**要求：**":', !hasRequirements ? '是' : '否');
    console.log('✅ 是否移除"**注意事项：**":', !hasNotes ? '是' : '否');
    console.log('✅ 是否移除分隔线:', !hasSeparator ? '是' : '否');
    
    // 显示前几行内容预览
    console.log('\n📖 过滤后内容预览（前10行）:');
    console.log('-' * 50);
    const previewLines = filteredContent.split('\n').slice(0, 10);
    previewLines.forEach((line, index) => {
      console.log(`${(index + 1).toString().padStart(2, '0')}: ${line}`);
    });
    
    if (filteredContent.split('\n').length > 10) {
      console.log('...');
      console.log(`总共 ${filteredContent.split('\n').length} 行`);
    }
    
    console.log('\n🎉 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  testFilterFunction();
}

module.exports = {
  filterSummaryContent,
  testFilterFunction
};
