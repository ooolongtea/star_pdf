/**
 * 化学式提取客户端工具
 * 用于与远程化学式提取服务器通信
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const FormData = require('form-data');
const { pool } = require('../config/db');

// 默认服务器URL
const DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL = 'http://172.19.1.81:8011';

/**
 * 将文件转换为Base64编码
 * @param {string} filePath - 文件路径
 * @returns {string} - Base64编码的文件内容
 */
function toBase64(filePath) {
  const fileData = fs.readFileSync(filePath);
  return fileData.toString('base64');
}

/**
 * 获取用户的服务器URL配置
 * @param {number} userId - 用户ID
 * @param {string} urlType - URL类型，'mineru'或'chemical'
 * @returns {Promise<string>} - 服务器URL
 */
async function getUserServerUrl(userId, urlType = 'chemical') {
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
    return urlType === 'chemical' ? DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL : DEFAULT_MINERU_SERVER_URL;
  } catch (error) {
    console.error('获取用户服务器URL配置失败:', error);
    // 出错时返回默认值
    return urlType === 'chemical' ? DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL : DEFAULT_MINERU_SERVER_URL;
  }
}

/**
 * 测试与化学式提取服务器的连接
 * @param {string} url - 服务器URL
 * @returns {Promise<boolean>} - 连接是否成功
 */
async function testConnection(url = DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL) {
  try {
    // 尝试访问服务器status API
    console.log(`测试连接到: ${url}/api/status`);
    const response = await axios.get(`${url}/api/status`);
    // console.log('服务器响应:', response.data);

    // 检查响应状态
    if (response.status === 200) {
      // 只要响应成功，就认为连接成功
      return true;
    }
    return false;
  } catch (error) {
    // 如果status接口失败，尝试health接口
    try {
      console.log(`尝试备用接口: ${url}/api/health`);
      const healthResponse = await axios.get(`${url}/api/health`);
      console.log('健康检查响应:', healthResponse.data);
      return healthResponse.status === 200;
    } catch (healthError) {
      // 如果health接口也失败，尝试list_files接口
      try {
        console.log(`尝试备用接口: ${url}/api/list_files?dir_path=/`);
        const filesResponse = await axios.get(`${url}/api/list_files?dir_path=/`);
        console.log('文件列表响应状态:', filesResponse.status);
        return filesResponse.status === 200;
      } catch (filesError) {
        console.error('测试化学式提取服务器连接失败:', error.message);
        return false;
      }
    }
  }
}

/**
 * 压缩目录为ZIP文件
 * @param {string} dirPath - 目录路径
 * @returns {Promise<string>} - 压缩文件路径
 */
async function compressDirectory(dirPath) {
  const archiver = require('archiver');

  // 创建临时ZIP文件路径
  const tempDir = path.join(os.tmpdir(), 'chemical_extraction');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const zipPath = path.join(tempDir, `${path.basename(dirPath)}.zip`);

  return new Promise((resolve, reject) => {
    console.log(`正在压缩目录 ${dirPath} 为 ${zipPath}...`);

    // 创建文件流
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最高压缩级别
    });

    // 监听错误
    archive.on('error', (err) => {
      reject(err);
    });

    // 监听关闭事件
    output.on('close', () => {
      console.log(`压缩完成，大小: ${archive.pointer()} 字节`);
      resolve(zipPath);
    });

    // 管道连接
    archive.pipe(output);

    // 添加目录到压缩文件
    archive.directory(dirPath, false);

    // 完成压缩
    archive.finalize();
  });
}

/**
 * 处理专利文件或目录，提取化学式
 * @param {string} patentPath - 专利文件或目录路径
 * @param {Object} options - 处理选项
 * @param {string} url - 服务器URL
 * @returns {Promise<Object>} - 处理结果
 */
async function processPatent(patentPath, options = {}, url = null) {
  // 如果没有提供URL，使用默认值
  url = url || `${DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL}/api/upload_and_process_alt`;

  try {
    console.log(`开始处理专利: ${patentPath}`);
    console.log(`处理选项:`, options);
    console.log(`服务器URL: ${url}`);

    // 检查路径是文件还是目录
    const isDirectory = fs.lstatSync(patentPath).isDirectory();
    const patentId = path.basename(patentPath, isDirectory ? '' : path.extname(patentPath));
    const originalFileName = path.basename(patentPath);

    let zipPath;

    // 判断是否需要批处理模式
    let isBatchMode = false;

    // 如果是目录，检查是否包含多个专利目录
    if (isDirectory) {
      console.log(`检查目录结构: ${patentPath}`);

      // 检查目录中是否包含子目录
      const items = fs.readdirSync(patentPath);
      const subDirs = items.filter(item => {
        const itemPath = path.join(patentPath, item);
        return fs.statSync(itemPath).isDirectory();
      });

      // 如果包含子目录，则认为是包含多个专利的目录，使用批处理模式
      if (subDirs.length > 0) {
        console.log(`发现${subDirs.length}个子目录，使用批处理模式`);
        isBatchMode = true;
      } else {
        console.log(`未发现子目录，使用单个专利处理模式`);
      }

      // 压缩目录
      zipPath = await compressDirectory(patentPath);
    }
    // 如果是PDF文件，创建临时目录，复制文件，然后压缩
    else if (path.extname(patentPath).toLowerCase() === '.pdf') {
      const tempDir = path.join(os.tmpdir(), 'chemical_extraction', patentId);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 复制PDF文件到临时目录
      const tempFilePath = path.join(tempDir, path.basename(patentPath));
      fs.copyFileSync(patentPath, tempFilePath);

      // 压缩临时目录
      zipPath = await compressDirectory(tempDir);
    }
    // 如果是ZIP文件，直接使用
    else if (path.extname(patentPath).toLowerCase() === '.zip') {
      zipPath = patentPath;

      // 对于ZIP文件，我们无法直接检查内部结构，默认使用非批处理模式
      console.log(`ZIP文件，默认使用单个专利处理模式`);
    }
    else {
      throw new Error(`不支持的文件类型: ${path.extname(patentPath)}`);
    }

    // 创建FormData对象
    const formData = new FormData();
    formData.append('patent_folder', fs.createReadStream(zipPath), `${patentId}.zip`);

    // 根据检测结果设置批处理模式
    formData.append('batch_mode', isBatchMode ? 'true' : 'false');
    console.log(`使用批处理模式: ${isBatchMode}`);

    // 如果是批处理模式，添加额外的选项
    if (isBatchMode) {
      options.batch_mode = true;
    }

    // 添加选项
    if (options) {
      for (const [key, value] of Object.entries(options)) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }

    // 发送请求到远程服务器
    console.log('发送请求到远程服务器...');
    console.log(`使用专利ID: ${patentId}`);

    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 300000 // 5分钟超时
    });

    console.log('远程服务器响应状态:', response.status);
    console.log('远程服务器响应数据:', response.data);

    // 如果创建了临时ZIP文件，删除它
    if (zipPath !== patentPath && fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    if (response.status === 200) {
      // 构造标准化的结果对象
      let result = {
        success: true,
        filePath: patentPath,
        patentId: patentId,
        originalFileName: originalFileName
      };

      // 合并远程服务器返回的数据
      if (typeof response.data === 'object') {
        result = { ...result, ...response.data };
      }

      // 确保结果包含必要的字段
      if (!result.message) {
        result.message = '处理成功';
      }

      // 处理下载路径
      if (response.data.output_dir) {
        result.results_path = response.data.output_dir;
      } else if (response.data.results_path) {
        result.results_path = response.data.results_path;
      } else if (response.data.download_path) {
        result.results_path = response.data.download_path;
      } else if (response.data.temp_dir) {
        result.results_path = response.data.temp_dir;
      }

      // 处理下载URL
      if (response.data.download_url) {
        // 如果返回的是相对URL，添加服务器基础URL
        if (response.data.download_url.startsWith('/')) {
          const baseUrl = url.substring(0, url.lastIndexOf('/api'));
          result.download_url = `${baseUrl}${response.data.download_url}`;
        } else {
          result.download_url = response.data.download_url;
        }
      }

      return result;
    } else {
      throw new Error(`远程服务器返回错误: ${response.status}`);
    }
  } catch (error) {
    console.error(`专利处理错误: ${patentPath} - ${error.message}`);
    if (error.response) {
      console.error('错误响应状态:', error.response.status);
      console.error('错误响应数据:', error.response.data);
    }
    throw error;
  }
}

/**
 * 下载处理结果
 * @param {string} resultsPath - 结果路径或专利ID
 * @param {string} localDir - 本地保存目录
 * @param {string} url - 服务器URL或完整的下载URL
 * @param {string} originalFileName - 原始文件名，用于保存下载的文件
 * @returns {Promise<Object>} - 下载结果
 */
async function downloadResults(resultsPath, localDir, url = null, originalFileName = null) {
  // 如果没有提供URL，使用默认值
  let downloadUrl = url;
  let baseUrl = DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL;

  if (!url) {
    // 默认使用download_directory API
    downloadUrl = `${baseUrl}/api/download_directory?dir_path=${encodeURIComponent(resultsPath)}`;
  } else if (url.indexOf('/api/') === -1 && !url.startsWith('http')) {
    // 如果URL不包含API路径且不是完整URL，则假设它是完整的下载URL
    downloadUrl = url;
  } else {
    // 从URL中提取基础URL
    baseUrl = url.substring(0, url.lastIndexOf('/api'));

    if (url.includes('/api/download_file')) {
      // 如果URL是download_file API
      downloadUrl = `${url}?file_path=${encodeURIComponent(resultsPath)}`;
    } else if (url.includes('/api/download_directory')) {
      // 如果URL是download_directory API
      downloadUrl = `${url}?dir_path=${encodeURIComponent(resultsPath)}`;
    } else if (url.includes('/api/download_results')) {
      // 如果URL是download_results API
      downloadUrl = `${url}?patent_id=${encodeURIComponent(resultsPath)}`;
    } else {
      // 默认使用download_directory API
      downloadUrl = `${baseUrl}/api/download_directory?dir_path=${encodeURIComponent(resultsPath)}`;
    }
  }

  try {
    console.log(`开始下载处理结果: ${resultsPath}`);
    console.log(`本地保存目录: ${localDir}`);
    console.log(`下载URL: ${downloadUrl}`);

    // 发送请求到远程服务器
    console.log('发送下载请求...');
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 300000 // 5分钟超时
    });

    console.log('下载响应状态:', response.status);
    console.log('下载响应内容类型:', response.headers['content-type']);
    console.log('下载响应内容长度:', response.data.length);

    if (response.status === 200) {
      // 确保本地目录存在
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      // 确定文件名
      let fileName;
      if (originalFileName) {
        // 使用原始文件名
        fileName = `${originalFileName}_results.zip`;
      } else {
        // 从结果路径或Content-Disposition头中提取文件名
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition && contentDisposition.includes('filename=')) {
          fileName = contentDisposition.split('filename=')[1].replace(/"/g, '');
        } else {
          fileName = `${path.basename(resultsPath)}_results.zip`;
        }
      }

      // 保存文件
      const localPath = path.join(localDir, fileName);
      console.log(`保存文件到: ${localPath}`);
      fs.writeFileSync(localPath, response.data);

      return {
        success: true,
        message: '结果下载成功',
        localPath
      };
    } else {
      throw new Error(`远程服务器返回错误: ${response.status}`);
    }
  } catch (error) {
    console.error(`结果下载错误: ${resultsPath} - ${error.message}`);
    if (error.response) {
      console.error('错误响应状态:', error.response.status);
      console.error('错误响应数据:', error.response.data);
    }

    // 尝试备用下载方法
    try {
      console.log('尝试备用下载方法...');

      // 构造备用下载URL
      let altDownloadUrl;

      // 尝试不同的API端点
      if (downloadUrl.includes('/api/download_directory')) {
        // 如果原始URL是download_directory API，尝试使用download_results API
        altDownloadUrl = `${baseUrl}/api/download_results?patent_id=${encodeURIComponent(resultsPath)}`;
      } else if (downloadUrl.includes('/api/download_results')) {
        // 如果原始URL是download_results API，尝试使用download_result API (注意单数形式)
        altDownloadUrl = `${baseUrl}/api/download_result?patent_id=${encodeURIComponent(resultsPath)}`;
      } else if (downloadUrl.includes('/api/download_file')) {
        // 如果原始URL是download_file API，尝试使用download_directory API
        altDownloadUrl = `${baseUrl}/api/download_directory?dir_path=${encodeURIComponent(resultsPath)}`;
      } else {
        // 默认尝试使用download_file API
        altDownloadUrl = `${baseUrl}/api/download_file?file_path=${encodeURIComponent(resultsPath)}`;
      }

      console.log(`备用下载URL: ${altDownloadUrl}`);
      const altResponse = await axios.get(altDownloadUrl, {
        responseType: 'arraybuffer',
        timeout: 300000 // 5分钟超时
      });

      console.log('备用下载响应状态:', altResponse.status);
      console.log('备用下载响应内容类型:', altResponse.headers['content-type']);
      console.log('备用下载响应内容长度:', altResponse.data.length);

      if (altResponse.status === 200) {
        // 确保本地目录存在
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }

        // 确定文件名
        let fileName;
        if (originalFileName) {
          // 使用原始文件名
          fileName = `${originalFileName}_results.zip`;
        } else {
          // 从结果路径或Content-Disposition头中提取文件名
          const contentDisposition = altResponse.headers['content-disposition'];
          if (contentDisposition && contentDisposition.includes('filename=')) {
            fileName = contentDisposition.split('filename=')[1].replace(/"/g, '');
          } else {
            fileName = `${path.basename(resultsPath)}_results.zip`;
          }
        }

        // 保存文件
        const localPath = path.join(localDir, fileName);
        console.log(`保存文件到: ${localPath}`);
        fs.writeFileSync(localPath, altResponse.data);

        return {
          success: true,
          message: '结果下载成功（备用方法）',
          localPath
        };
      }
    } catch (altError) {
      console.error(`备用下载方法失败: ${altError.message}`);
      if (altError.response) {
        console.error('备用错误响应状态:', altError.response.status);
        console.error('备用错误响应数据:', altError.response.data);
      }
    }

    // 如果所有方法都失败，尝试第三种方法 - 使用download_batch_results
    try {
      console.log('尝试第三种下载方法...');
      const thirdDownloadUrl = `${baseUrl}/api/download_batch_results?result_dir=${encodeURIComponent(resultsPath)}`;

      console.log(`尝试第三种下载URL: ${thirdDownloadUrl}`);
      const thirdResponse = await axios.get(thirdDownloadUrl, {
        responseType: 'arraybuffer',
        timeout: 300000 // 5分钟超时
      });

      console.log('第三种下载响应状态:', thirdResponse.status);
      console.log('第三种下载响应内容类型:', thirdResponse.headers['content-type']);
      console.log('第三种下载响应内容长度:', thirdResponse.data.length);

      if (thirdResponse.status === 200) {
        // 确保本地目录存在
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }

        // 确定文件名
        let fileName;
        if (originalFileName) {
          // 使用原始文件名
          fileName = `${originalFileName}_results.zip`;
        } else {
          // 从结果路径或Content-Disposition头中提取文件名
          const contentDisposition = thirdResponse.headers['content-disposition'];
          if (contentDisposition && contentDisposition.includes('filename=')) {
            fileName = contentDisposition.split('filename=')[1].replace(/"/g, '');
          } else {
            fileName = `${path.basename(resultsPath)}_results.zip`;
          }
        }

        // 保存文件
        const localPath = path.join(localDir, fileName);
        console.log(`保存文件到: ${localPath}`);
        fs.writeFileSync(localPath, thirdResponse.data);

        return {
          success: true,
          message: '结果下载成功（第三种方法）',
          localPath
        };
      }
    } catch (thirdError) {
      console.error(`第三种下载方法失败: ${thirdError.message}`);
      if (thirdError.response) {
        console.error('第三种错误响应状态:', thirdError.response.status);
        console.error('第三种错误响应数据:', thirdError.response.data);
      }
    }

    throw error;
  }
}

module.exports = {
  DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL,
  getUserServerUrl,
  testConnection,
  processPatent,
  downloadResults
};
