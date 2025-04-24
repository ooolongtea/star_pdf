/**
 * MinerU 客户端工具
 * 用于与远程 MinerU 服务器通信，处理 PDF 转换和化学式提取
 */

const fs = require('fs');
const axios = require('axios');

// 远程服务器配置
const REMOTE_SERVER_URL = 'http://172.19.1.81:8010/predict';

/**
 * 将文件转换为 base64 编码
 * @param {string} filePath - 文件路径
 * @returns {string} - base64 编码的文件内容
 */
function toBase64(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath);
    return fileContent.toString('base64');
  } catch (error) {
    throw new Error(`File: ${filePath} - Info: ${error.message}`);
  }
}

/**
 * 发送文件到远程服务器进行解析
 * @param {string} filePath - 文件路径
 * @param {Object} options - 解析选项
 * @param {string} options.url - 远程服务器 URL，默认为 REMOTE_SERVER_URL
 * @param {string} options.parseMethod - 解析方法，默认为 'auto'
 * @param {boolean} options.debugMode - 是否启用调试模式，默认为 false
 * @returns {Promise<Object>} - 解析结果
 */
async function parseFile(filePath, options = {}) {
  const url = options.url || REMOTE_SERVER_URL;
  const parseMethod = options.parseMethod || 'auto';
  const debugMode = options.debugMode || false;

  try {
    console.log(`开始解析文件: ${filePath}`);
    console.log(`解析选项: 方法=${parseMethod}, 调试=${debugMode}`);

    // 发送请求到远程服务器
    const response = await axios.post(url, {
      file: toBase64(filePath),
      kwargs: {
        debug_able: debugMode,
        parse_method: parseMethod
      }
    });

    if (response.status === 200) {
      const result = response.data;
      result.filePath = filePath;
      return result;
    } else {
      throw new Error(`远程服务器返回错误: ${response.status}`);
    }
  } catch (error) {
    console.error(`文件解析错误: ${filePath} - ${error.message}`);
    throw error;
  }
}

module.exports = {
  toBase64,
  parseFile
};
