const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise'); // 使用 mysql2 的 promise 接口

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'patent_extractor',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/pdf');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 限制文件大小为 50MB
  fileFilter: function (req, file, cb) {
    // 检查文件类型
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型。支持的类型: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG'));
    }
  }
}).single('file');

// 导入MinerU客户端工具
const mineruClient = require('../utils/mineru_client');

// 远程服务器配置（默认值，实际使用时会从用户设置中获取）
const DEFAULT_MINERU_SERVER_URL = mineruClient.DEFAULT_MINERU_SERVER_URL;
const DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL = mineruClient.DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL;

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 计算目录大小的函数
function calculateDirectorySize(dirPath) {
  let totalSize = 0;

  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      totalSize += calculateDirectorySize(filePath);
    } else {
      totalSize += stats.size;
    }
  }

  return totalSize;
}

// 递归下载远程目录的函数
async function downloadRemoteDirectory(remotePath, localPath, originalFilename = null, userId = null, serverBaseUrl = null) {
  // 创建本地目录
  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
  }

  try {
    // 如果没有提供服务器URL，尝试从用户设置中获取
    let baseUrl = serverBaseUrl;
    if (!baseUrl && userId) {
      baseUrl = await mineruClient.getUserServerUrl(userId, 'mineru');
    }
    // 如果仍然没有URL，使用默认值
    baseUrl = baseUrl || DEFAULT_MINERU_SERVER_URL;

    console.log(`获取远程目录列表: ${remotePath}`);
    // 获取远程目录列表
    const response = await axios.get(`${baseUrl}/files/list?path=${encodeURIComponent(remotePath)}`, {
      timeout: 30000
    });

    if (!response.data || !response.data.files) {
      console.error(`获取远程目录列表失败: ${remotePath}`);
      return false;
    }

    const files = response.data.files;
    console.log(`远程目录 ${remotePath} 中有 ${files.length} 个文件/目录`);

    // 提取请求ID（用于匹配文件名）
    const pathParts = remotePath.split('/');
    const requestId = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];

    // 下载每个文件
    let downloadPromises = [];
    for (const file of files) {
      const remoteFilePath = `${remotePath}/${file.name}`;

      // 确定本地文件路径
      let localFilePath;

      // 保持原始目录结构，不修改文件名
      if (remotePath.includes('/auto/')) {
        // 从remotePath中提取相对路径部分
        const relativePathMatch = remotePath.match(/\/auto\/(.+)/);
        if (relativePathMatch && relativePathMatch[1]) {
          const relativePath = relativePathMatch[1];
          const subDir = path.join(localPath, 'auto', relativePath);

          // 确保子目录存在
          if (!fs.existsSync(subDir)) {
            fs.mkdirSync(subDir, { recursive: true });
          }

          localFilePath = path.join(subDir, file.name);
        } else {
          // 如果是auto目录下的文件
          const autoDir = path.join(localPath, 'auto');
          if (!fs.existsSync(autoDir)) {
            fs.mkdirSync(autoDir, { recursive: true });
          }

          localFilePath = path.join(autoDir, file.name);
        }
      } else if (remotePath.includes(`/${requestId}/`)) {
        // 如果是请求ID目录下的文件，放到auto目录中
        const autoDir = path.join(localPath, 'auto');
        if (!fs.existsSync(autoDir)) {
          fs.mkdirSync(autoDir, { recursive: true });
        }

        localFilePath = path.join(autoDir, file.name);
      } else {
        // 如果是根目录下的文件，也放到auto目录中
        const autoDir = path.join(localPath, 'auto');
        if (!fs.existsSync(autoDir)) {
          fs.mkdirSync(autoDir, { recursive: true });
        }

        localFilePath = path.join(autoDir, file.name);
      }

      if (file.isDirectory) {
        // 递归下载子目录
        console.log(`下载子目录: ${remoteFilePath}`);
        const subDirPromise = downloadRemoteDirectory(remoteFilePath, localPath, originalFilename);
        downloadPromises.push(subDirPromise);
      } else {
        // 下载文件
        const filePromise = (async () => {
          try {
            // console.log(`下载文件: ${remoteFilePath}`);
            const fileResponse = await axios.get(`${baseUrl}/files?path=${encodeURIComponent(remoteFilePath)}`, {
              responseType: 'arraybuffer',
              timeout: 60000 // 设置较长的超时时间，以处理大文件
            });

            // 确保目录存在
            const fileDir = path.dirname(localFilePath);
            if (!fs.existsSync(fileDir)) {
              fs.mkdirSync(fileDir, { recursive: true });
            }

            fs.writeFileSync(localFilePath, fileResponse.data);
            // console.log(`文件已保存: ${localFilePath} (原始文件: ${file.name})`);

            // 如果是图片文件，确保在images目录中也有一份副本
            if (['.jpg', '.jpeg', '.png', '.gif'].includes(path.extname(file.name).toLowerCase())) {
              const imagesDir = path.join(localPath, 'auto', 'images');
              if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
              }

              const imageInImagesDir = path.join(imagesDir, file.name);
              if (!fs.existsSync(imageInImagesDir)) {
                fs.copyFileSync(localFilePath, imageInImagesDir);
                console.log(`图片已复制到images目录: ${imageInImagesDir}`);
              }
            }

            return true;
          } catch (error) {
            console.error(`下载文件失败: ${remoteFilePath}, 错误: ${error.message}`);
            return false;
          }
        })();
        downloadPromises.push(filePromise);
      }
    }

    // 等待所有下载完成
    const results = await Promise.all(downloadPromises);

    // 如果有文件下载成功，就返回成功
    return results.some(result => result === true);
  } catch (error) {
    console.error(`下载目录失败: ${remotePath}, 错误: ${error.message}`);
    return false;
  }
}

// 初始化数据库表
async function initDatabase() {
  try {
    const connection = await pool.getConnection();

    // 检查 pdf_files 表是否存在
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = 'patent_extractor'
      AND TABLE_NAME = 'pdf_files'
    `);

    // 如果表不存在，则创建
    if (tables.length === 0) {
      console.log('创建 pdf_files 表...');
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS pdf_files (
          id VARCHAR(36) PRIMARY KEY,
          user_id INT NOT NULL,
          original_filename VARCHAR(255) NOT NULL,
          file_type VARCHAR(50) NOT NULL,
          markdown_path VARCHAR(255),
          formulas_path VARCHAR(255),
          formulas_count INT DEFAULT 0,
          status VARCHAR(50) DEFAULT 'processing',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    }

    connection.release();
    // console.log('数据库表初始化完成');
  } catch (error) {
    console.error('数据库初始化错误:', error);
  }
}

// 在应用启动时初始化数据库
initDatabase();

// 测试与远程服务器的连接
exports.testConnection = async (req, res) => {
  try {
    // 获取用户ID或从查询参数中获取URL
    const userId = req.user && req.user.id ? req.user.id : null;
    const urlFromQuery = req.query.url;

    // 优先使用查询参数中的URL，其次使用用户配置，最后使用默认值
    let serverUrl = urlFromQuery || DEFAULT_MINERU_SERVER_URL;
    if (!urlFromQuery && userId) {
      serverUrl = await mineruClient.getUserServerUrl(userId, 'mineru');
    }

    // 确保URL不以/predict结尾
    if (serverUrl.endsWith('/predict')) {
      serverUrl = serverUrl.substring(0, serverUrl.length - 8);
    }

    console.log(`测试与远程服务器的连接: ${serverUrl}/ping`);
    const response = await axios.get(`${serverUrl}/ping`);

    if (response.status === 200 && response.data.status === 'ok') {
      console.log('远程服务器连接成功:', response.data);
      return res.status(200).json({
        success: true,
        message: '远程服务器连接成功',
        data: response.data
      });
    } else {
      throw new Error('远程服务器返回异常状态');
    }
  } catch (error) {
    console.error('远程服务器连接测试失败:', error);
    return res.status(500).json({
      success: false,
      message: '远程服务器连接失败',
      error: error.message
    });
  }
};

// 获取用户的PDF文件列表
exports.getUserFiles = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      // 使用默认用户ID 1，或者从请求中获取用户ID（如果存在）
      const userId = req.user && req.user.id ? req.user.id : 1;

      // 查询用户的所有文件
      const [rows] = await connection.execute(
        'SELECT * FROM pdf_files WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );

      // 构建响应数据
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const files = rows.map(file => {
        // 检查是否过期
        const isExpired = file.expires_at && new Date(file.expires_at) < new Date();

        // 处理可能的文件名编码问题
        let originalFilename = file.original_filename;
        try {
          // 使用更可靠的方法处理中文文件名
          if (/[\u0080-\uffff]/.test(originalFilename)) {
            // 尝试使用不同的编码方式解码
            try {
              // 尝试UTF-8解码
              const buffer = Buffer.from(originalFilename, 'binary');
              const utf8Name = buffer.toString('utf8');
              if (utf8Name !== originalFilename && /[\u4e00-\u9fa5]/.test(utf8Name)) {
                originalFilename = utf8Name;
              }
            } catch (e) {
              // 如果UTF-8解码失败，尝试GBK/GB2312编码
              try {
                const iconv = require('iconv-lite');
                if (iconv.encodingExists('gbk')) {
                  const buffer = Buffer.from(originalFilename, 'binary');
                  const gbkName = iconv.decode(buffer, 'gbk');
                  if (gbkName.length > 0 && /[\u4e00-\u9fa5]/.test(gbkName)) {
                    originalFilename = gbkName;
                  }
                }
              } catch (gbkError) {
                console.error('GBK解码失败:', gbkError);
              }
            }
          }

          // 移除任何不可打印字符
          originalFilename = originalFilename.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

          // 确保文件名是有效的
          if (!originalFilename || originalFilename.trim() === '') {
            originalFilename = '未命名文件';
          }
        } catch (error) {
          console.error('文件名解码错误:', error);
          // 如果解码失败，使用原始文件名
        }

        return {
          id: file.id,
          originalFilename: originalFilename,
          fileType: file.file_type,
          status: file.status,
          createdAt: file.created_at,
          markdownUrl: file.markdown_path ? `${baseUrl}/${file.markdown_path}` : null,
          formulasUrl: file.formulas_path ? `${baseUrl}/${file.formulas_path}` : null,
          formulasCount: file.formulas_count,
          resultsDir: file.results_dir ? `${baseUrl}/${file.results_dir}` : null,
          resultsSize: file.results_size || 0,
          expiresAt: file.expires_at,
          isExpired: isExpired,
          downloadCount: file.download_count || 0,
          lastDownloaded: file.last_downloaded_at,
          lastAccessed: file.last_accessed_at
        };
      });

      res.status(200).json({
        success: true,
        data: files
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('获取用户文件列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取文件列表失败',
      error: error.message
    });
  }
};

// 获取单个PDF文件的详细信息
exports.getFileDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      // 使用默认用户ID 1，或者从请求中获取用户ID（如果存在）
      const userId = req.user && req.user.id ? req.user.id : 1;

      // 查询文件信息
      const [rows] = await connection.execute(
        'SELECT * FROM pdf_files WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: '文件不存在或无权访问'
        });
      }

      const file = rows[0];

      // 更新最后访问时间
      await connection.execute(
        'UPDATE pdf_files SET last_accessed_at = NOW() WHERE id = ?',
        [id]
      );

      // 检查是否过期
      const isExpired = file.expires_at && new Date(file.expires_at) < new Date();

      // 处理可能的文件名编码问题
      let originalFilename = file.original_filename;
      try {
        // 使用更可靠的方法处理中文文件名
        if (/[\u0080-\uffff]/.test(originalFilename)) {
          // 尝试使用不同的编码方式解码
          try {
            // 尝试UTF-8解码
            const buffer = Buffer.from(originalFilename, 'binary');
            const utf8Name = buffer.toString('utf8');
            if (utf8Name !== originalFilename && /[\u4e00-\u9fa5]/.test(utf8Name)) {
              originalFilename = utf8Name;
            }
          } catch (e) {
            // 如果UTF-8解码失败，尝试GBK/GB2312编码
            try {
              const iconv = require('iconv-lite');
              if (iconv.encodingExists('gbk')) {
                const buffer = Buffer.from(originalFilename, 'binary');
                const gbkName = iconv.decode(buffer, 'gbk');
                if (gbkName.length > 0 && /[\u4e00-\u9fa5]/.test(gbkName)) {
                  originalFilename = gbkName;
                }
              }
            } catch (gbkError) {
              console.error('GBK解码失败:', gbkError);
            }
          }
        }

        // 移除任何不可打印字符
        originalFilename = originalFilename.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

        // 确保文件名是有效的
        if (!originalFilename || originalFilename.trim() === '') {
          originalFilename = '未命名文件';
        }
      } catch (error) {
        console.error('文件名解码错误:', error);
        // 如果解码失败，使用原始文件名
      }

      // 构建响应数据
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fileDetails = {
        id: file.id,
        originalFilename: originalFilename,
        fileType: file.file_type,
        status: file.status,
        createdAt: file.created_at,
        markdownUrl: file.markdown_path ? `${baseUrl}/${file.markdown_path}` : null,
        formulasUrl: file.formulas_path ? `${baseUrl}/${file.formulas_path}` : null,
        formulasCount: file.formulas_count,
        resultsDir: file.results_dir ? `${baseUrl}/${file.results_dir}` : null,
        resultsSize: file.results_size || 0,
        expiresAt: file.expires_at,
        isExpired: isExpired,
        downloadCount: file.download_count || 0,
        lastDownloaded: file.last_downloaded_at,
        lastAccessed: file.last_accessed_at
      };

      // 如果有化学式文件，读取其内容
      if (file.formulas_path) {
        try {
          const formulasContent = fs.readFileSync(path.join(__dirname, '../..', file.formulas_path), 'utf8');
          fileDetails.formulas = JSON.parse(formulasContent);
        } catch (error) {
          console.error('读取化学式文件错误:', error);
        }
      }

      res.status(200).json({
        success: true,
        data: fileDetails
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('获取文件详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取文件详情失败',
      error: error.message
    });
  }
};

// 删除PDF文件
exports.deleteFile = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      // 使用默认用户ID 1，或者从请求中获取用户ID（如果存在）
      const userId = req.user && req.user.id ? req.user.id : 1;

      // 查询文件信息
      const [rows] = await connection.execute(
        'SELECT * FROM pdf_files WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: '文件不存在或无权访问'
        });
      }

      // 删除文件
      const resultDir = path.join(__dirname, '../../uploads/results', id);
      if (fs.existsSync(resultDir)) {
        fs.rmdirSync(resultDir, { recursive: true });
      }

      // 从数据库中删除记录
      await connection.execute(
        'DELETE FROM pdf_files WHERE id = ?',
        [id]
      );

      res.status(200).json({
        success: true,
        message: '文件已删除'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('删除文件错误:', error);
    res.status(500).json({
      success: false,
      message: '删除文件失败',
      error: error.message
    });
  }
};

// 获取PDF文件的所有结果文件列表
exports.getFileResults = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      // 使用默认用户ID 1，或者从请求中获取用户ID（如果存在）
      const userId = req.user && req.user.id ? req.user.id : 1;

      // 查询文件信息
      const [rows] = await connection.execute(
        'SELECT * FROM pdf_files WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: '文件不存在或无权访问'
        });
      }

      const fileInfo = rows[0];

      // 检查是否过期
      if (fileInfo.expires_at && new Date(fileInfo.expires_at) < new Date()) {
        return res.status(403).json({
          success: false,
          message: '文件结果已过期'
        });
      }

      // 更新最后访问时间
      await connection.execute(
        'UPDATE pdf_files SET last_accessed_at = NOW() WHERE id = ?',
        [id]
      );

      // 获取结果目录中的文件列表
      const resultsDir = path.join(__dirname, '../..', fileInfo.results_dir || `uploads/results/${id}`);
      const fileList = [];

      if (fs.existsSync(resultsDir)) {
        // 递归获取目录中的所有文件
        function getFiles(dir, baseDir = '') {
          const items = fs.readdirSync(dir);

          for (const item of items) {
            const fullPath = path.join(dir, item);
            const relativePath = path.join(baseDir, item);
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
              getFiles(fullPath, relativePath);
            } else {
              fileList.push({
                name: item,
                path: relativePath,
                size: stats.size,
                lastModified: stats.mtime,
                type: path.extname(item).substring(1) || 'unknown'
              });
            }
          }
        }

        getFiles(resultsDir);
      }

      // 处理可能的文件名编码问题
      let originalFilename = fileInfo.original_filename;
      try {
        // 使用更可靠的方法处理中文文件名
        if (/[\u0080-\uffff]/.test(originalFilename)) {
          // 尝试使用不同的编码方式解码
          try {
            // 尝试UTF-8解码
            const buffer = Buffer.from(originalFilename, 'binary');
            const utf8Name = buffer.toString('utf8');
            if (utf8Name !== originalFilename && /[\u4e00-\u9fa5]/.test(utf8Name)) {
              originalFilename = utf8Name;
            }
          } catch (e) {
            // 如果UTF-8解码失败，尝试GBK/GB2312编码
            try {
              const iconv = require('iconv-lite');
              if (iconv.encodingExists('gbk')) {
                const buffer = Buffer.from(originalFilename, 'binary');
                const gbkName = iconv.decode(buffer, 'gbk');
                if (gbkName.length > 0 && /[\u4e00-\u9fa5]/.test(gbkName)) {
                  originalFilename = gbkName;
                }
              }
            } catch (gbkError) {
              console.error('GBK解码失败:', gbkError);
            }
          }
        }

        // 移除任何不可打印字符
        originalFilename = originalFilename.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

        // 确保文件名是有效的
        if (!originalFilename || originalFilename.trim() === '') {
          originalFilename = '未命名文件';
        }
      } catch (error) {
        console.error('文件名解码错误:', error);
        // 如果解码失败，使用原始文件名
      }

      // 构建响应数据
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fileDetails = {
        id: fileInfo.id,
        originalFilename: originalFilename,
        fileType: fileInfo.file_type,
        status: fileInfo.status,
        createdAt: fileInfo.created_at,
        expiresAt: fileInfo.expires_at,
        markdownUrl: fileInfo.markdown_path ? `${baseUrl}/${fileInfo.markdown_path}` : null,
        formulasUrl: fileInfo.formulas_path ? `${baseUrl}/${fileInfo.formulas_path}` : null,
        formulasCount: fileInfo.formulas_count,
        resultsSize: fileInfo.results_size,
        files: fileList.map(f => ({
          ...f,
          url: `${baseUrl}/api/pdf/files/${id}/download?path=${encodeURIComponent(f.path)}`
        }))
      };

      res.status(200).json({
        success: true,
        data: fileDetails
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('获取文件结果错误:', error);
    res.status(500).json({
      success: false,
      message: '获取文件结果失败',
      error: error.message
    });
  }
};

// 下载特定结果文件
exports.downloadResultFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { path: filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: '缺少文件路径参数'
      });
    }

    const connection = await pool.getConnection();
    try {
      // 使用默认用户ID 1，或者从请求中获取用户ID（如果存在）
      const userId = req.user && req.user.id ? req.user.id : 1;

      // 查询文件信息
      const [rows] = await connection.execute(
        'SELECT * FROM pdf_files WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: '文件不存在或无权访问'
        });
      }

      const fileInfo = rows[0];

      // 检查是否过期
      if (fileInfo.expires_at && new Date(fileInfo.expires_at) < new Date()) {
        return res.status(403).json({
          success: false,
          message: '文件结果已过期'
        });
      }

      // 构建完整的文件路径
      const fullPath = path.join(__dirname, '../..', fileInfo.results_dir || `uploads/results/${id}`, filePath);

      // 检查文件是否存在
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        });
      }

      // 更新下载计数和最后下载时间
      await connection.execute(
        'UPDATE pdf_files SET download_count = download_count + 1, last_downloaded_at = NOW() WHERE id = ?',
        [id]
      );

      // 获取原始文件名
      let originalFilename = fileInfo.original_filename;
      try {
        // 使用更可靠的方法处理中文文件名
        if (/[\u0080-\uffff]/.test(originalFilename)) {
          // 尝试使用不同的编码方式解码
          try {
            // 尝试UTF-8解码
            const buffer = Buffer.from(originalFilename, 'binary');
            const utf8Name = buffer.toString('utf8');
            if (utf8Name !== originalFilename && /[\u4e00-\u9fa5]/.test(utf8Name)) {
              originalFilename = utf8Name;
            }
          } catch (e) {
            // 如果UTF-8解码失败，尝试GBK/GB2312编码
            try {
              const iconv = require('iconv-lite');
              if (iconv.encodingExists('gbk')) {
                const buffer = Buffer.from(originalFilename, 'binary');
                const gbkName = iconv.decode(buffer, 'gbk');
                if (gbkName.length > 0 && /[\u4e00-\u9fa5]/.test(gbkName)) {
                  originalFilename = gbkName;
                }
              }
            } catch (gbkError) {
              console.error('GBK解码失败:', gbkError);
            }
          }
        }

        // 移除任何不可打印字符
        originalFilename = originalFilename.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

        // 确保文件名是有效的
        if (!originalFilename || originalFilename.trim() === '') {
          originalFilename = '未命名文件';
        }
      } catch (error) {
        console.error('文件名解码错误:', error);
        // 如果解码失败，使用原始文件名
      }

      // 获取文件名
      const fileName = path.basename(filePath);

      // 构建更友好的下载文件名
      const fileNameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
      const downloadFileName = `${fileNameWithoutExt}_${fileName}`;

      // 发送文件
      res.download(fullPath, downloadFileName);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('下载结果文件错误:', error);
    res.status(500).json({
      success: false,
      message: '下载结果文件失败',
      error: error.message
    });
  }
};

// 下载所有结果（打包为ZIP）
exports.downloadAllResults = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      // 使用默认用户ID 1，或者从请求中获取用户ID（如果存在）
      const userId = req.user && req.user.id ? req.user.id : 1;

      // 查询文件信息
      const [rows] = await connection.execute(
        'SELECT * FROM pdf_files WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: '文件不存在或无权访问'
        });
      }

      const fileInfo = rows[0];

      // 检查是否过期
      if (fileInfo.expires_at && new Date(fileInfo.expires_at) < new Date()) {
        return res.status(403).json({
          success: false,
          message: '文件结果已过期'
        });
      }

      // 处理可能的文件名编码问题
      let originalFilename = fileInfo.original_filename;
      try {
        // 使用更可靠的方法处理中文文件名
        if (/[\u0080-\uffff]/.test(originalFilename)) {
          // 尝试使用不同的编码方式解码
          try {
            // 尝试UTF-8解码
            const buffer = Buffer.from(originalFilename, 'binary');
            const utf8Name = buffer.toString('utf8');
            if (utf8Name !== originalFilename && /[\u4e00-\u9fa5]/.test(utf8Name)) {
              originalFilename = utf8Name;
            }
          } catch (e) {
            // 如果UTF-8解码失败，尝试GBK/GB2312编码
            try {
              const iconv = require('iconv-lite');
              if (iconv.encodingExists('gbk')) {
                const buffer = Buffer.from(originalFilename, 'binary');
                const gbkName = iconv.decode(buffer, 'gbk');
                if (gbkName.length > 0 && /[\u4e00-\u9fa5]/.test(gbkName)) {
                  originalFilename = gbkName;
                }
              }
            } catch (gbkError) {
              console.error('GBK解码失败:', gbkError);
            }
          }
        }

        // 移除任何不可打印字符
        originalFilename = originalFilename.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

        // 确保文件名是有效的
        if (!originalFilename || originalFilename.trim() === '') {
          originalFilename = '未命名文件';
        }

        // 更新fileInfo对象，以便后续使用
        fileInfo.original_filename = originalFilename;
      } catch (error) {
        console.error('文件名解码错误:', error);
        // 如果解码失败，使用原始文件名
      }

      // 结果目录
      const resultsDir = path.join(__dirname, '../..', fileInfo.results_dir || `uploads/results/${id}`);

      // 检查目录是否存在
      if (!fs.existsSync(resultsDir)) {
        return res.status(404).json({
          success: false,
          message: '结果目录不存在'
        });
      }

      // 创建临时ZIP文件 - 使用原始文件名
      const fileNameWithoutExt = fileInfo.original_filename.replace(/\.[^/.]+$/, '');
      const zipFilePath = path.join(require('os').tmpdir(), `${fileNameWithoutExt}_results.zip`);

      // 使用archiver创建ZIP文件
      const archiver = require('archiver');
      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      // 监听关闭事件
      output.on('close', async () => {
        try {
          // 更新下载计数和最后下载时间
          await connection.execute(
            'UPDATE pdf_files SET download_count = download_count + 1, last_downloaded_at = NOW() WHERE id = ?',
            [id]
          );
        } catch (error) {
          console.error('更新下载信息错误:', error);
        }

        // 发送ZIP文件
        const downloadFileName = `${fileNameWithoutExt}_结果文件.zip`;
        res.download(zipFilePath, downloadFileName, () => {
          // 下载完成后删除临时文件
          if (fs.existsSync(zipFilePath)) {
            fs.unlinkSync(zipFilePath);
          }
        });
      });

      // 监听错误事件
      archive.on('error', (err) => {
        if (fs.existsSync(zipFilePath)) {
          fs.unlinkSync(zipFilePath);
        }
        throw err;
      });

      // 将输出流管道连接到文件
      archive.pipe(output);

      // 预先扫描所有文件
      const fileList = [];
      const scanFiles = (dir) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stats = fs.statSync(fullPath);
          if (stats.isDirectory()) {
            scanFiles(fullPath);
          } else {
            fileList.push({
              name: item,
              path: fullPath,
              ext: path.extname(item).toLowerCase()
            });
          }
        }
      };

      // 扫描所有文件
      scanFiles(resultsDir);

      // 手动添加文件到归档，保持原始目录结构
      const addFilesToArchive = (dir) => {
        const items = fs.readdirSync(dir);

        // 计算相对于结果目录的路径
        const relPath = path.relative(resultsDir, dir);
        // 在ZIP中使用相同的相对路径
        const zipDir = relPath ? relPath : '';

        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            // 如果是目录，递归处理
            addFilesToArchive(fullPath);
          } else {
            // 如果是文件，添加到归档，保持原始文件名
            const zipPath = zipDir ? path.join(zipDir, item) : item;
            archive.file(fullPath, { name: zipPath });
          }
        }
      };

      // 添加文件到归档
      addFilesToArchive(resultsDir);

      // 完成归档
      archive.finalize();
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('下载所有结果错误:', error);
    res.status(500).json({
      success: false,
      message: '下载所有结果失败',
      error: error.message
    });
  }
};

// 转换 PDF 文件
exports.convertPdf = async (req, res) => {
  try {
    // 使用 multer 处理文件上传
    upload(req, res, async function (err) {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传文件'
        });
      }

      // 获取上传的文件
      const filePath = req.file.path;

      // 处理文件名编码问题
      let originalFilename = req.file.originalname;

      // 使用更可靠的方法处理中文文件名
      try {
        // 检查是否需要解码
        if (/[\u0080-\uffff]/.test(originalFilename)) {
          // 尝试使用不同的编码方式解码
          try {
            // 尝试UTF-8解码 - 使用Buffer替代弃用的escape函数
            const buffer = Buffer.from(originalFilename, 'binary');
            const utf8Name = buffer.toString('utf8');
            if (utf8Name !== originalFilename && /[\u4e00-\u9fa5]/.test(utf8Name)) {
              originalFilename = utf8Name;
              console.log(`UTF-8解码后的文件名: ${originalFilename}`);
            }
          } catch (e) {
            // 如果UTF-8解码失败，尝试其他方法
            try {
              // 尝试GBK/GB2312编码（常见于中文Windows系统）
              const iconv = require('iconv-lite');
              if (iconv.encodingExists('gbk')) {
                const buffer = Buffer.from(originalFilename, 'binary');
                const gbkName = iconv.decode(buffer, 'gbk');
                if (gbkName.length > 0 && /[\u4e00-\u9fa5]/.test(gbkName)) {
                  originalFilename = gbkName;
                  console.log(`GBK解码后的文件名: ${originalFilename}`);
                }
              }
            } catch (gbkError) {
              console.error('GBK解码失败:', gbkError);
            }
          }
        }

        // 移除任何不可打印字符
        originalFilename = originalFilename.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

        // 确保文件名是有效的
        if (!originalFilename || originalFilename.trim() === '') {
          originalFilename = '未命名文件';
        }

        console.log(`最终处理后的文件名: ${originalFilename}`);
      } catch (error) {
        console.error('文件名编码转换错误:', error);
        // 如果所有转换都失败，使用一个默认名称
        originalFilename = `未命名文件_${Date.now()}`;
      }

      console.log(`处理文件: ${originalFilename}`);
      const fileType = path.extname(originalFilename).substring(1);

      // 生成唯一ID
      const fileId = uuidv4();

      // 创建结果目录
      const resultDir = path.join(__dirname, '../../uploads/results', fileId);
      if (!fs.existsSync(resultDir)) {
        fs.mkdirSync(resultDir, { recursive: true });
      }

      console.log(`开始转换文件: ${originalFilename}, ID: ${fileId}`);

      try {
        // 将文件信息保存到数据库
        const dbConnection = await pool.getConnection();
        try {
          // 使用默认用户ID 1，或者从请求中获取用户ID（如果存在）
          const userId = req.user && req.user.id ? req.user.id : 1;

          await dbConnection.execute(
            'INSERT INTO pdf_files (id, user_id, original_filename, file_type, status) VALUES (?, ?, ?, ?, ?)',
            [fileId, userId, originalFilename, fileType, 'processing']
          );
          console.log(`文件信息已保存到数据库: ${fileId}`);
        } finally {
          dbConnection.release();
        }

        // 获取文件大小
        const stats = fs.statSync(filePath);
        const fileSizeInMB = stats.size / (1024 * 1024);

        // 检查文件大小是否超过限制（设置为50MB）
        if (fileSizeInMB > 50) {
          throw new Error(`文件过大（${fileSizeInMB.toFixed(2)}MB），超过了50MB的限制。请上传更小的文件。`);
        }

        // 读取文件并转换为 base64
        const fileContent = fs.readFileSync(filePath);
        const fileBase64 = fileContent.toString('base64');

        // 获取用户ID或从查询参数中获取URL
        const userId = req.user && req.user.id ? req.user.id : 1;

        // 获取用户配置的服务器URL或使用默认值
        let serverUrl = await mineruClient.getUserServerUrl(userId, 'mineru');

        // 确保URL以/predict结尾
        if (serverUrl && !serverUrl.endsWith('/predict')) {
          serverUrl = serverUrl + '/predict';
        }

        // 发送请求到远程服务器
        console.log(`发送请求到远程服务器: ${serverUrl}`);

        // 准备请求数据
        let requestData = {
          file: fileBase64,
          kwargs: {
            // PDF转换不涉及化学公式，使用默认参数
            debug_able: false
          }
        };

        // 根据文件类型调整请求参数
        if (fileType.toLowerCase() === 'docx' || fileType.toLowerCase() === 'doc') {
          // Word文件处理需要request_id参数
          requestData.request_id = fileId;
        } else if (fileType.toLowerCase() === 'pdf') {
          // PDF文件处理不需要request_id参数
          // 但可能需要在kwargs中添加其他特定参数
          // 这里不添加request_id
        } else {
          // 其他类型文件，尝试添加request_id到kwargs
          requestData.kwargs.request_id = fileId;
        }

        console.log(`请求参数: ${JSON.stringify(requestData, null, 2)}`);
        const response = await axios.post(serverUrl, requestData, {
          timeout: 300000, // 设置超时时间为5分钟
          maxBodyLength: 100 * 1024 * 1024, // 设置最大请求体大小为100MB
          maxContentLength: 100 * 1024 * 1024 // 设置最大内容长度为100MB
        });

        if (response.status === 200) {
          const outputDir = response.data.output_dir;
          console.log(`文件转换成功，输出目录: ${outputDir}`);

          // 确保使用正斜杠（/）作为路径分隔符，适用于Linux服务器
          const outputDirFormatted = outputDir.replace(/\\/g, '/');

          // 从请求ID中提取文件名
          // 对于PDF文件，可能没有返回request_id，使用我们自己的fileId
          const requestId = response.data.request_id || fileId;

          // 设置本地保存目录
          const resultDir = path.join(__dirname, '../../uploads/results', fileId);
          if (!fs.existsSync(resultDir)) {
            fs.mkdirSync(resultDir, { recursive: true });
          }

          // 下载整个远程目录
          console.log(`开始下载远程目录: ${outputDirFormatted}`);
          const downloadSuccess = await downloadRemoteDirectory(outputDirFormatted, resultDir, originalFilename);

          if (!downloadSuccess) {
            console.error(`下载远程目录失败: ${outputDirFormatted}`);
            throw new Error('下载远程处理结果失败');
          }

          console.log(`远程目录下载完成: ${outputDirFormatted}`);

          // 检查是否存在Markdown文件
          let localMarkdownPath = null;
          const possibleMarkdownPaths = [
            path.join(resultDir, 'auto', `${requestId}.md`),
            path.join(resultDir, `${requestId}.md`),
            path.join(resultDir, 'auto', 'output.md'),
            path.join(resultDir, 'output.md')
          ];

          for (const mdPath of possibleMarkdownPaths) {
            if (fs.existsSync(mdPath)) {
              localMarkdownPath = mdPath;
              console.log(`找到Markdown文件: ${localMarkdownPath}`);
              break;
            }
          }

          // 如果没有找到Markdown文件，创建一个空的
          if (!localMarkdownPath) {
            console.warn('未找到Markdown文件，创建一个空的');
            // 使用原始文件名（不带扩展名）作为Markdown文件名
            const fileNameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
            localMarkdownPath = path.join(resultDir, `${fileNameWithoutExt}.md`);
            fs.writeFileSync(localMarkdownPath, `# ${originalFilename}\n\n文件已成功转换，但未找到Markdown输出。`);
          } else {
            // 不修改Markdown文件中的图片引用，保留原始引用
            console.log(`使用原始Markdown文件: ${localMarkdownPath}`);
          }

          // 相对路径，用于存储到数据库
          const relativeMarkdownPath = path.relative(path.join(__dirname, '../..'), localMarkdownPath);

          // 检查是否存在化学式文件
          let extractedFormulas = [];
          let relativeFormulasPath = null;
          const possibleFormulasPaths = [
            path.join(resultDir, 'auto', `${requestId}_content_list.json`),
            path.join(resultDir, 'auto', 'formulas.json'),
            path.join(resultDir, 'formulas.json')
          ];

          for (const formulasPath of possibleFormulasPaths) {
            if (fs.existsSync(formulasPath)) {
              try {
                const formulasContent = fs.readFileSync(formulasPath, 'utf8');
                extractedFormulas = JSON.parse(formulasContent);
                relativeFormulasPath = path.relative(path.join(__dirname, '../..'), formulasPath);
                console.log(`找到化学式文件: ${formulasPath}, 包含 ${extractedFormulas.length} 个化学式`);
                break;
              } catch (error) {
                console.error(`读取化学式文件失败: ${formulasPath}, 错误: ${error.message}`);
              }
            }
          }

          // 计算结果大小
          const resultSize = calculateDirectorySize(resultDir);
          console.log(`结果目录大小: ${resultSize} 字节`);

          // 设置过期时间（例如30天后）
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          // 更新数据库中的文件信息
          const dbConn = await pool.getConnection();
          try {
            await dbConn.execute(
              `UPDATE pdf_files SET
                status = ?,
                markdown_path = ?,
                formulas_path = ?,
                formulas_count = ?,
                results_dir = ?,
                results_size = ?,
                expires_at = ?,
                last_accessed_at = NOW()
              WHERE id = ?`,
              [
                'completed',
                relativeMarkdownPath,
                relativeFormulasPath,
                extractedFormulas.length,
                path.relative(path.join(__dirname, '../..'), resultDir),
                resultSize,
                expiresAt,
                fileId
              ]
            );
            console.log(`文件信息已更新: ${fileId}`);
          } finally {
            dbConn.release();
          }

          // 返回结果
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          res.status(200).json({
            success: true,
            message: '文件转换成功',
            data: {
              fileId: fileId,
              markdownUrl: `${baseUrl}/${relativeMarkdownPath}`,
              formulasUrl: extractedFormulas.length > 0 ? `${baseUrl}/${relativeFormulasPath}` : null,
              resultsDir: `${baseUrl}/uploads/results/${fileId}`,
              expiresAt: expiresAt,
              extractedFormulas: extractedFormulas
            }
          });
        } else {
          // 更新数据库中的文件状态为失败
          const connection = await pool.getConnection();
          try {
            await connection.execute(
              'UPDATE pdf_files SET status = ? WHERE id = ?',
              ['failed', fileId]
            );
          } finally {
            connection.release();
          }

          throw new Error('远程服务器处理失败');
        }
      } catch (error) {
        // 更新数据库中的文件状态为失败
        try {
          const connection = await pool.getConnection();
          try {
            await connection.execute(
              'UPDATE pdf_files SET status = ? WHERE id = ?',
              ['failed', fileId]
            );
          } finally {
            connection.release();
          }
        } catch (dbError) {
          console.error('更新文件状态失败:', dbError);
        }

        console.error('文件转换错误:', error);
        res.status(500).json({
          success: false,
          message: `文件转换失败: ${error.message}`
        });
      } finally {
        // 清理上传的文件
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('清理上传文件失败:', e);
        }
      }
    });
  } catch (error) {
    console.error('PDF 转换错误:', error);
    res.status(500).json({
      success: false,
      message: '文件处理失败',
      error: error.message
    });
  }
};

// 获取图片文件
exports.getImageFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const imageName = req.params.imageName;

    // 构建图片路径
    const imagePath = path.join(__dirname, '../../uploads/results', fileId, 'auto', 'images', imageName);

    // 检查文件是否存在
    if (fs.existsSync(imagePath)) {
      return res.sendFile(imagePath);
    }

    // 如果文件不存在，尝试查找类似的文件
    const imagesDir = path.join(__dirname, '../../uploads/results', fileId, 'auto', 'images');
    if (fs.existsSync(imagesDir)) {
      const files = fs.readdirSync(imagesDir);

      // 尝试查找匹配的文件
      const matchingFile = files.find(file => {
        // 尝试不同的匹配策略
        // 1. 完全匹配
        if (file === imageName) return true;

        // 2. 前缀匹配（至少8个字符）
        if (file.length >= 8 && imageName.length >= 8) {
          if (file.startsWith(imageName.substring(0, 8)) ||
            imageName.startsWith(file.substring(0, 8))) {
            return true;
          }
        }

        // 3. 哈希值匹配（去掉文件扩展名后比较）
        const fileWithoutExt = file.replace(/\.[^/.]+$/, '');
        const imageNameWithoutExt = imageName.replace(/\.[^/.]+$/, '');

        if (fileWithoutExt === imageNameWithoutExt) return true;

        return false;
      });

      if (matchingFile) {
        const matchingPath = path.join(imagesDir, matchingFile);
        return res.sendFile(matchingPath);
      }
    }

    // 如果找不到匹配的文件，返回404错误
    return res.status(404).json({
      success: false,
      message: '图片文件不存在'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取图片文件失败',
      error: error.message
    });
  }
};
