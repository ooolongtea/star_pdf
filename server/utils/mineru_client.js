/**
 * MinerU 客户端工具
 * 用于与远程 MinerU 服务器通信，处理 PDF 转换和化学式提取
 */

const fs = require('fs');
const axios = require('axios');
const { pool } = require('../config/db');

// 默认远程服务器配置
const DEFAULT_MINERU_SERVER_URL = 'http://172.19.1.81:8010';
const DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL = 'http://172.19.1.81:8011';

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
 * 获取用户的服务器URL配置
 * @param {number} userId - 用户ID
 * @param {string} urlType - URL类型，'mineru'或'chemical'
 * @returns {Promise<string>} - 服务器URL
 */
async function getUserServerUrl(userId, urlType = 'mineru') {
  try {
    // 查询用户设置
    const [rows] = await pool.execute(
      'SELECT mineru_server_url, chemical_extraction_server_url FROM settings WHERE user_id = ?',
      [userId]
    );

    if (rows.length > 0) {
      if (urlType === 'mineru') {
        return rows[0].mineru_server_url || DEFAULT_MINERU_SERVER_URL;
      } else if (urlType === 'chemical') {
        return rows[0].chemical_extraction_server_url || DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL;
      }
    }

    // 如果没有找到设置或URL类型不匹配，返回默认值
    return urlType === 'mineru' ? DEFAULT_MINERU_SERVER_URL : DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL;
  } catch (error) {
    console.error('获取用户服务器URL配置失败:', error);
    // 出错时返回默认值
    return urlType === 'mineru' ? DEFAULT_MINERU_SERVER_URL : DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL;
  }
}

/**
 * 发送文件到远程服务器进行解析
 * @param {string} filePath - 文件路径
 * @param {Object} options - 解析选项
 * @param {string} options.url - 远程服务器 URL，如果不提供则使用用户配置
 * @param {number} options.userId - 用户ID，用于获取配置
 * @param {string} options.parseMethod - 解析方法，默认为 'auto'
 * @param {boolean} options.debugMode - 是否启用调试模式，默认为 false
 * @returns {Promise<Object>} - 解析结果
 */
async function parseFile(filePath, options = {}) {
  // 如果提供了URL，直接使用；否则尝试获取用户配置
  let url = options.url;
  if (!url && options.userId) {
    url = await getUserServerUrl(options.userId, 'mineru');
  }

  // 确保URL以/predict结尾
  if (url && !url.endsWith('/predict')) {
    url = url + '/predict';
  }

  // 如果仍然没有URL，使用默认值
  url = url || `${DEFAULT_MINERU_SERVER_URL}/predict`;

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
  parseFile,
  getUserServerUrl,
  DEFAULT_MINERU_SERVER_URL,
  DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL
};
