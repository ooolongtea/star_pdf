const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise'); // 使用 mysql2 的 promise 接口
const archiver = require('archiver'); // 用于创建ZIP文件
const tiktoken = require('tiktoken'); // 用于准确计算token数量

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
        // console.log(`下载子目录: ${remoteFilePath}`);
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
          optimized_markdown_path VARCHAR(255),
          formulas_path VARCHAR(255),
          formulas_count INT DEFAULT 0,
          status VARCHAR(50) DEFAULT 'processing',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // 检查是否需要添加optimized_markdown_path列
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'patent_extractor'
        AND TABLE_NAME = 'pdf_files'
        AND COLUMN_NAME = 'optimized_markdown_path'
      `);

      // 如果列不存在，则添加
      if (columns.length === 0) {
        console.log('添加 optimized_markdown_path 列...');
        await connection.execute(`
          ALTER TABLE pdf_files
          ADD COLUMN optimized_markdown_path VARCHAR(255) AFTER markdown_path
        `);
      }
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

    const response = await axios.get(`${serverUrl}/ping`);

    if (response.status === 200 && response.data.status === 'ok') {
      return res.status(200).json({
        success: true,
        message: '远程服务器连接成功',
        data: response.data
      });
    } else {
      throw new Error('远程服务器返回异常状态');
    }
  } catch (error) {
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

      // 获取文件名和扩展名
      const fileName = path.basename(filePath);
      const fileExt = path.extname(fileName).toLowerCase();

      // 提取原始文件名（不带扩展名）
      const fileNameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
      // 确保文件名不包含非法字符
      const safeOriginalName = fileNameWithoutExt.replace(/[\\/:*?"<>|]/g, '_');

      // 构建更友好的下载文件名
      let downloadFileName;

      // 根据文件类型决定下载文件名
      if (fileName.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+$/i)) {
        // UUID格式的文件名，直接使用原始文件名
        downloadFileName = `${safeOriginalName}${fileExt}`;
      } else if (fileExt === '.md') {
        // Markdown文件使用原始文件名
        downloadFileName = `${safeOriginalName}.md`;
      } else if (fileName.startsWith(id)) {
        // 以请求ID开头的文件，使用原始文件名
        downloadFileName = `${safeOriginalName}${fileExt}`;
      } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExt)) {
        // 图片文件，保留原名但添加前缀
        downloadFileName = `${safeOriginalName}_${fileName}`;
      } else {
        // 其他文件，添加原始文件名作为前缀
        downloadFileName = `${safeOriginalName}_${fileName}`;
      }

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
      // 确保文件名不包含非法字符
      const safeFileName = fileNameWithoutExt.replace(/[\\/:*?"<>|]/g, '_');
      const zipFilePath = path.join(require('os').tmpdir(), `${safeFileName}_results.zip`);

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

        // 发送ZIP文件 - 使用原始文件名
        const safeOriginalName = fileNameWithoutExt.replace(/[\\/:*?"<>|]/g, '_');
        const downloadFileName = `${safeOriginalName}_结果文件.zip`;
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

      // 手动添加文件到归档，使用更友好的文件名
      const addFilesToArchive = (dir) => {
        const items = fs.readdirSync(dir);

        // 计算相对于结果目录的路径
        const relPath = path.relative(resultsDir, dir);
        // 在ZIP中使用相同的相对路径
        const zipDir = relPath ? relPath : '';

        // 提取原始文件名（不带扩展名）
        const originalNameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
        // 确保文件名不包含非法字符
        const safeOriginalName = originalNameWithoutExt.replace(/[\\/:*?"<>|]/g, '_');

        // 获取请求ID（用于识别需要重命名的文件）
        const requestId = id; // 使用URL参数中的文件ID作为请求ID

        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            // 如果是目录，递归处理
            addFilesToArchive(fullPath);
          } else {
            // 如果是文件，添加到归档
            let zipItemName = item;
            const fileExt = path.extname(item).toLowerCase();

            // 根据文件类型和命名模式决定最终文件名
            if (item.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+$/i)) {
              // UUID格式的文件名，替换为原始文件名
              zipItemName = safeOriginalName + fileExt;
            } else if (fileExt === '.md') {
              // Markdown文件使用原始文件名
              zipItemName = safeOriginalName + '.md';
            } else if (item.startsWith(requestId)) {
              // 以请求ID开头的文件，替换为原始文件名
              zipItemName = safeOriginalName + fileExt;
            } else if (fileExt === '.pdf' && !item.includes('_')) {
              // 可能是原始PDF文件
              zipItemName = safeOriginalName + '.pdf';
            } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExt)) {
              // 图片文件保留原名，因为可能在Markdown中被引用
              // 但如果以UUID开头，则替换前缀
              if (item.match(/^[0-9a-f]{8}-[0-9a-f]{4}/i)) {
                zipItemName = safeOriginalName + '_' + item.substring(item.indexOf('-') + 1);
              }
            }

            // 构建ZIP中的路径
            const zipPath = zipDir ? path.join(zipDir, zipItemName) : zipItemName;

            // 添加文件到归档
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
              // console.log(`UTF-8解码后的文件名: ${originalFilename}`);
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

        // console.log(`请求参数: ${JSON.stringify(requestData, null, 2)}`);
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
    let imageName = req.params.imageName;


    // 检查是否是截断的文件名（以...结尾）
    const isTruncated = imageName.includes('…') || imageName.includes('...');

    // 如果是截断的文件名，提取前缀部分
    if (isTruncated) {
      imageName = imageName.replace(/[…\.]+.*$/, '');
      console.log(`检测到截断的文件名，使用前缀匹配: ${imageName}`);
    }

    // 尝试多个可能的图片路径
    const possiblePaths = [
      // 1. 标准路径
      path.join(__dirname, '../../uploads/results', fileId, 'auto', 'images', imageName),
      // 2. 不带auto子目录的路径
      path.join(__dirname, '../../uploads/results', fileId, 'images', imageName),
      // 3. 直接在结果目录下的路径
      path.join(__dirname, '../../uploads/results', fileId, imageName),
      // 4. auto目录下的路径
      path.join(__dirname, '../../uploads/results', fileId, 'auto', imageName),
      // 5. 使用hash作为文件名的路径
      path.join(__dirname, '../../uploads/results', fileId, 'auto', 'images', imageName.split('.')[0] + '.jpg'),
      // 6. 使用hash作为文件名的路径（png格式）
      path.join(__dirname, '../../uploads/results', fileId, 'auto', 'images', imageName.split('.')[0] + '.png')
    ];

    // 检查文件是否存在于任何一个可能的路径
    // console.log('尝试以下可能的路径:');
    for (const possiblePath of possiblePaths) {
      // console.log(`- 检查路径: ${possiblePath}`);
      if (fs.existsSync(possiblePath)) {
        // console.log(`找到图片文件: ${possiblePath}`);
        return res.sendFile(possiblePath);
      }
    }

    // 如果直接路径都不存在，尝试在images目录中查找类似的文件
    const imagesDirs = [
      path.join(__dirname, '../../uploads/results', fileId, 'auto', 'images'),
      path.join(__dirname, '../../uploads/results', fileId, 'images')
    ];

    for (const imagesDir of imagesDirs) {
      console.log(`检查目录: ${imagesDir}`);
      if (fs.existsSync(imagesDir)) {
        const files = fs.readdirSync(imagesDir);
        console.log(`目录 ${imagesDir} 中有 ${files.length} 个文件`);

        if (files.length > 0) {
          console.log(`目录中的前5个文件: ${files.slice(0, 5).join(', ')}`);
        }

        // 尝试查找匹配的文件
        const matchingFile = files.find(file => {
          // 尝试不同的匹配策略
          // 1. 完全匹配
          if (file === imageName) {
            console.log(`完全匹配: ${file} === ${imageName}`);
            return true;
          }

          // 2. 前缀匹配
          // 如果是截断的文件名或者有足够长度的前缀（至少6个字符）
          if (isTruncated || (file.length >= 6 && imageName.length >= 6)) {
            const prefixLength = Math.min(imageName.length, 8); // 使用最多8个字符作为前缀
            if (file.startsWith(imageName.substring(0, prefixLength))) {
              console.log(`前缀匹配: ${file} 以 ${imageName.substring(0, prefixLength)} 开头`);
              return true;
            }

            // 检查文件名是否以请求的图片名称开头
            if (imageName.startsWith(file.substring(0, prefixLength))) {
              console.log(`反向前缀匹配: ${imageName} 以 ${file.substring(0, prefixLength)} 开头`);
              return true;
            }
          }

          // 3. 哈希值匹配（去掉文件扩展名后比较）
          const fileWithoutExt = file.replace(/\.[^/.]+$/, '');
          const imageNameWithoutExt = imageName.replace(/\.[^/.]+$/, '');

          if (fileWithoutExt === imageNameWithoutExt) {
            console.log(`哈希值匹配: ${fileWithoutExt} === ${imageNameWithoutExt}`);
            return true;
          }

          // 4. 部分哈希匹配（对于长哈希值文件名）
          if (fileWithoutExt.length > 20 && imageNameWithoutExt.length > 6) {
            // 使用前6个字符进行匹配
            if (fileWithoutExt.startsWith(imageNameWithoutExt.substring(0, 6))) {
              console.log(`部分哈希匹配: ${fileWithoutExt} 以 ${imageNameWithoutExt.substring(0, 6)} 开头`);
              return true;
            }

            // 使用后6个字符进行匹配
            if (fileWithoutExt.endsWith(imageNameWithoutExt.substring(imageNameWithoutExt.length - 6))) {
              console.log(`部分哈希匹配(后缀): ${fileWithoutExt} 以 ${imageNameWithoutExt.substring(imageNameWithoutExt.length - 6)} 结尾`);
              return true;
            }

            // 检查是否包含部分哈希
            if (fileWithoutExt.includes(imageNameWithoutExt.substring(0, 10))) {
              console.log(`包含哈希匹配: ${fileWithoutExt} 包含 ${imageNameWithoutExt.substring(0, 10)}`);
              return true;
            }

            // 检查是否包含部分哈希（反向）
            if (imageNameWithoutExt.includes(fileWithoutExt.substring(0, 10))) {
              console.log(`反向包含哈希匹配: ${imageNameWithoutExt} 包含 ${fileWithoutExt.substring(0, 10)}`);
              return true;
            }
          }

          // 5. 检查文件扩展名
          // 如果请求的图片名称没有扩展名，尝试匹配相同名称但有扩展名的文件
          if (!imageName.includes('.')) {
            const fileNameWithoutExt = file.replace(/\.[^/.]+$/, '');
            if (fileNameWithoutExt === imageName) {
              console.log(`扩展名匹配: ${fileNameWithoutExt} === ${imageName}`);
              return true;
            }
          }

          return false;
        });

        if (matchingFile) {
          const matchingPath = path.join(imagesDir, matchingFile);
          console.log(`找到匹配的图片文件: ${matchingFile}`);
          return res.sendFile(matchingPath);
        }
      } else {
        console.log(`目录不存在: ${imagesDir}`);
      }
    }

    // 如果仍然找不到，尝试在整个结果目录中递归查找
    const resultsDir = path.join(__dirname, '../../uploads/results', fileId);
    if (fs.existsSync(resultsDir)) {
      console.log(`在整个结果目录中递归查找图片: ${imageName}`);

      // 递归查找函数
      const findImageRecursively = (dir) => {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            // 递归查找子目录
            const found = findImageRecursively(itemPath);
            if (found) return found;
          } else if (stats.isFile()) {
            // 检查是否匹配
            if (item === imageName) {
              console.log(`递归查找 - 完全匹配: ${item}`);
              return itemPath;
            }

            // 检查哈希值匹配
            const itemWithoutExt = item.replace(/\.[^/.]+$/, '');
            const imageNameWithoutExt = imageName.replace(/\.[^/.]+$/, '');

            if (itemWithoutExt === imageNameWithoutExt) {
              console.log(`递归查找 - 哈希值匹配: ${itemWithoutExt}`);
              return itemPath;
            }

            // 检查部分哈希匹配
            if (itemWithoutExt.length > 20 && imageNameWithoutExt.length > 6) {
              if (itemWithoutExt.startsWith(imageNameWithoutExt.substring(0, 6))) {
                console.log(`递归查找 - 部分哈希匹配: ${itemWithoutExt}`);
                return itemPath;
              }

              // 检查是否包含部分哈希
              if (itemWithoutExt.includes(imageNameWithoutExt.substring(0, 10))) {
                console.log(`递归查找 - 包含哈希匹配: ${itemWithoutExt}`);
                return itemPath;
              }

              // 检查是否包含部分哈希（反向）
              if (imageNameWithoutExt.includes(itemWithoutExt.substring(0, 10))) {
                console.log(`递归查找 - 反向包含哈希匹配: ${imageNameWithoutExt}`);
                return itemPath;
              }
            }

            // 检查文件扩展名
            const itemExt = path.extname(item).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.gif'].includes(itemExt)) {
              // 如果是图片文件，检查文件名是否相似
              const similarity = calculateSimilarity(itemWithoutExt, imageNameWithoutExt);
              if (similarity > 0.7) { // 70%相似度
                console.log(`递归查找 - 相似度匹配 (${similarity.toFixed(2)}): ${item}`);
                return itemPath;
              }
            }
          }
        }

        return null;
      };

      // 计算两个字符串的相似度（简单实现）
      const calculateSimilarity = (str1, str2) => {
        // 如果字符串长度差异太大，直接返回低相似度
        if (Math.abs(str1.length - str2.length) > Math.min(str1.length, str2.length) * 0.5) {
          return 0;
        }

        // 计算公共子串长度
        let commonChars = 0;
        const minLength = Math.min(str1.length, str2.length);
        for (let i = 0; i < minLength; i++) {
          if (str1[i] === str2[i]) {
            commonChars++;
          }
        }

        return commonChars / Math.max(str1.length, str2.length);
      };

      const foundImagePath = findImageRecursively(resultsDir);
      if (foundImagePath) {
        console.log(`递归查找找到图片文件: ${foundImagePath}`);
        return res.sendFile(foundImagePath);
      }
    } else {
      console.log(`结果目录不存在: ${resultsDir}`);
    }

    // 如果找不到匹配的文件，返回404错误
    console.log(`未找到图片文件: ${imageName}`);
    return res.status(404).json({
      success: false,
      message: '图片文件不存在',
      requestedImage: imageName,
      fileId: fileId
    });
  } catch (error) {
    console.error('获取图片文件错误:', error);
    res.status(500).json({
      success: false,
      message: '获取图片文件失败',
      error: error.message
    });
  }
};

// 优化PDF文件内容
exports.optimizePdfContent = async (req, res) => {
  // 创建一个清理函数，用于在处理完成或发生错误时清理资源
  const cleanupResources = (tempDirs = []) => {
    try {
      console.log('清理临时资源...');
      // 清理临时目录
      for (const dir of tempDirs) {
        if (fs.existsSync(dir)) {
          // 使用递归删除目录
          fs.rmSync(dir, { recursive: true, force: true });
          console.log(`已清理临时目录: ${dir}`);
        }
      }
    } catch (error) {
      console.error('清理资源时出错:', error);
    }
  };

  // 根据模型提供商获取默认API基础URL的辅助函数
  function getDefaultApiBaseUrl(provider) {
    const baseUrls = {
      'qwen': 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      'deepseek': 'https://api.deepseek.com',
      'baichuan': 'https://api.baichuan-ai.com/v1',
      'chatglm': 'https://open.bigmodel.cn/api/paas/v3'
    };

    return baseUrls[provider] || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  }

  let connection = null;
  const tempDirs = []; // 用于存储需要清理的临时目录

  try {
    const { id } = req.params;
    const { prompt, model } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: '缺少优化提示词'
      });
    }

    // 使用请求中提供的模型，如果没有则默认使用qwen-turbo-latest
    const modelToUse = model || 'qwen-turbo-latest';
    console.log(`使用模型: ${modelToUse} 进行优化`);

    connection = await pool.getConnection();

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

    // 获取Markdown内容
    if (!fileInfo.markdown_path) {
      return res.status(400).json({
        success: false,
        message: '找不到Markdown内容'
      });
    }

    const markdownPath = path.join(__dirname, '../..', fileInfo.markdown_path);
    if (!fs.existsSync(markdownPath)) {
      return res.status(404).json({
        success: false,
        message: 'Markdown文件不存在'
      });
    }

    const markdownContent = fs.readFileSync(markdownPath, 'utf8');

    // 使用正则表达式提取不能改变的内容（如图片索引行）
    console.log('提取不能改变的内容...');

    // 存储需要保留的内容
    const preservedContent = [];

    // 正则表达式匹配图片索引行
    // 匹配Markdown格式的图片引用: ![alt text](path/to/image.jpg)
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

    // 匹配HTML格式的图片引用: <img src="path/to/image.jpg" alt="alt text">
    const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;

    // 匹配可能的表格行
    const tableRegex = /\|[^|]+\|[^|]+\|/g;

    // 匹配数学公式
    const mathRegex = /\$\$[^$]+\$\$|\$[^$\n]+\$/g;

    // 处理后的内容，替换需要保留的部分为占位符
    let processedContent = markdownContent;

    // 生成唯一标识符
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

    // 替换图片引用
    processedContent = processedContent.replace(imageRegex, (match) => {
      const placeholder = `__PRESERVED_IMAGE_${uniqueId}_${preservedContent.length}__`;
      preservedContent.push({ placeholder, content: match });
      return placeholder;
    });

    // 替换HTML图片标签
    processedContent = processedContent.replace(htmlImageRegex, (match) => {
      const placeholder = `__PRESERVED_HTML_IMAGE_${uniqueId}_${preservedContent.length}__`;
      preservedContent.push({ placeholder, content: match });
      return placeholder;
    });

    // 替换表格行
    processedContent = processedContent.replace(tableRegex, (match) => {
      // 只有当它看起来确实是表格行时才替换
      if (match.split('|').length > 3) {
        const placeholder = `__PRESERVED_TABLE_${uniqueId}_${preservedContent.length}__`;
        preservedContent.push({ placeholder, content: match });
        return placeholder;
      }
      return match;
    });

    // 替换数学公式
    processedContent = processedContent.replace(mathRegex, (match) => {
      const placeholder = `__PRESERVED_MATH_${uniqueId}_${preservedContent.length}__`;
      preservedContent.push({ placeholder, content: match });
      return placeholder;
    });

    console.log(`提取了 ${preservedContent.length} 个需要保留的内容`);

    // 调用AI模型API进行优化
    const chatController = require('./chat.controller');

    // 构建消息
    const messages = [
      {
        role: 'system',
        content: '你是一个专业的OCR后处理专家，擅长优化从PDF提取的文本内容，修复OCR错误，调整格式，使其更易阅读。'
      },
      {
        role: 'user',
        content: `${prompt}\n\n以下是从PDF提取的原始内容，其中包含一些以__PRESERVED_开头和__结尾的占位符。你必须完全保留这些占位符，不得以任何方式修改它们的格式或内容。\n\n${processedContent}`
      }
    ];

    // 从模型名称中提取提供商ID
    let providerId = 'qwen'; // 默认使用qwen
    let actualModelToUse = modelToUse;
    let apiKey, apiBaseUrl;

    // 如果模型名称包含提供商信息（如 provider:model 格式）
    if (modelToUse.includes(':')) {
      [providerId] = modelToUse.split(':');
    } else if (modelToUse.toLowerCase().includes('qwen')) {
      providerId = 'qwen';
    } else if (modelToUse.toLowerCase().includes('deepseek')) {
      providerId = 'deepseek';
    } else if (modelToUse.toLowerCase().includes('baichuan')) {
      providerId = 'baichuan';
    } else if (modelToUse.toLowerCase().includes('chatglm')) {
      providerId = 'chatglm';
    }

    console.log(`识别的模型提供商: ${providerId}`);

    // 获取用户的API密钥
    let apiKeyResult = await connection.execute(
      'SELECT * FROM api_keys WHERE user_id = ? AND model_name = ? AND is_active = 1 LIMIT 1',
      [userId, providerId]
    );
    let apiKeyRows = apiKeyResult[0];

    if (apiKeyRows.length === 0) {
      // 如果没有找到特定提供商的API密钥，尝试查找qwen的API密钥作为备选
      if (providerId !== 'qwen') {
        let fallbackResult = await connection.execute(
          'SELECT * FROM api_keys WHERE user_id = ? AND model_name = ? AND is_active = 1 LIMIT 1',
          [userId, 'qwen']
        );
        let fallbackKeyRows = fallbackResult[0];

        if (fallbackKeyRows.length > 0) {
          console.log(`未找到${providerId}模型的API密钥，使用qwen模型的API密钥作为备选`);
          apiKey = fallbackKeyRows[0].api_key;
          apiBaseUrl = fallbackKeyRows[0].api_base_url || getDefaultApiBaseUrl('qwen');

          // 由于使用了备选API密钥，强制使用qwen模型
          actualModelToUse = 'qwen-turbo-latest';
          console.log(`已切换到备选模型: ${actualModelToUse}`);
        } else {
          if (connection) connection.release();
          cleanupResources(tempDirs);
          return res.status(400).json({
            success: false,
            message: `未找到${providerId}模型的API密钥，请在API密钥管理中添加`
          });
        }
      } else {
        if (connection) connection.release();
        cleanupResources(tempDirs);
        return res.status(400).json({
          success: false,
          message: '未找到Qwen模型的API密钥，请在API密钥管理中添加'
        });
      }
    } else {
      console.log(`找到${providerId}模型的API密钥`);
      apiKey = apiKeyRows[0].api_key;
      apiBaseUrl = apiKeyRows[0].api_base_url || getDefaultApiBaseUrl(providerId);
    }

    console.log('开始调用AI模型优化内容...');
    console.log(`使用模型: ${actualModelToUse}`);

    // 创建临时目录路径
    const tempDir = path.join(__dirname, '../../uploads/temp', id);
    const progressDir = path.join(__dirname, '../../uploads/results', id, 'progress');

    // 添加到需要清理的目录列表
    tempDirs.push(tempDir);

    // 创建临时目录
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    if (!fs.existsSync(progressDir)) {
      fs.mkdirSync(progressDir, { recursive: true });
    }

    try {
      // 分段处理长文档，每段最大token数为6500（预留一些空间，qwen-turbo-latest最大支持8192）
      const MAX_TOKENS_PER_SEGMENT = 6500;
      const SEGMENT_OVERLAP_SIZE = 500; // 段落之间的重叠部分，确保上下文连贯

      // 使用tiktoken准确计算token数量
      const countTokens = (text) => {
        try {
          // 使用cl100k_base编码器，适用于大多数现代模型
          const encoding = tiktoken.get_encoding("cl100k_base");
          const tokens = encoding.encode(text);
          return tokens.length;
        } catch (error) {
          console.error('tiktoken计算token错误:', error);

          // 如果tiktoken失败，回退到估算方法
          const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
          const otherChars = text.length - chineseChars;
          return Math.ceil(chineseChars / 1.5) + Math.ceil(otherChars / 4);
        }
      };

      // 改进的分段函数，使用滑动窗口并处理重叠
      const splitIntoSegments = (text) => {
        const segments = [];
        // 按段落分割文本
        const paragraphs = text.split('\n\n');

        // 初始化第一个段落
        let currentSegment = '';
        let currentTokens = 0;
        let paragraphBuffer = []; // 用于存储当前段落的缓冲区

        for (let i = 0; i < paragraphs.length; i++) {
          const paragraph = paragraphs[i];
          const paragraphTokens = countTokens(paragraph);

          // 如果单个段落就超过了最大token数，需要进一步分割
          if (paragraphTokens > MAX_TOKENS_PER_SEGMENT) {
            // 如果当前段落不为空，先添加到segments
            if (currentSegment) {
              segments.push(currentSegment);
              currentSegment = '';
              currentTokens = 0;
              paragraphBuffer = [];
            }

            // 按句子分割大段落，使用更精确的句子分割正则表达式
            const sentences = paragraph.split(/(?<=[.!?。！？])\s*/).filter(s => s.trim());
            let sentenceSegment = '';
            let sentenceTokens = 0;
            let sentenceBuffer = []; // 用于存储当前句子的缓冲区

            for (const sentence of sentences) {
              const sentenceTokenCount = countTokens(sentence);

              // 如果单个句子超过最大token数，需要进一步分割
              if (sentenceTokenCount > MAX_TOKENS_PER_SEGMENT) {
                console.log(`警告: 发现超长句子 (${sentenceTokenCount} tokens)，将被分割`);
                // 如果当前有积累的句子，先添加到segments
                if (sentenceSegment) {
                  segments.push(sentenceSegment);
                }

                // 按字符分割超长句子
                const chunkSize = Math.floor(MAX_TOKENS_PER_SEGMENT / 2); // 预估每个字符的token数
                for (let j = 0; j < sentence.length; j += chunkSize) {
                  const chunk = sentence.substring(j, j + chunkSize);
                  segments.push(chunk);
                }

                sentenceSegment = '';
                sentenceTokens = 0;
                sentenceBuffer = [];
              }
              // 正常句子处理
              else if (sentenceTokens + sentenceTokenCount <= MAX_TOKENS_PER_SEGMENT) {
                sentenceSegment += (sentenceSegment ? ' ' : '') + sentence;
                sentenceTokens += sentenceTokenCount;
                sentenceBuffer.push(sentence);
              } else {
                // 当前段落已满，添加到segments
                if (sentenceSegment) {
                  segments.push(sentenceSegment);
                }

                // 开始新段落，并添加重叠部分
                // 从缓冲区中取最后几个句子作为重叠部分
                const overlapSentences = sentenceBuffer.slice(Math.max(0, sentenceBuffer.length - Math.ceil(SEGMENT_OVERLAP_SIZE / 100)));
                sentenceSegment = overlapSentences.join(' ') + ' ' + sentence;
                sentenceTokens = countTokens(sentenceSegment);
                sentenceBuffer = [...overlapSentences, sentence];
              }
            }

            // 添加最后一个句子段落
            if (sentenceSegment) {
              segments.push(sentenceSegment);
            }
          }
          // 正常段落处理
          else if (currentTokens + paragraphTokens <= MAX_TOKENS_PER_SEGMENT) {
            currentSegment += (currentSegment ? '\n\n' : '') + paragraph;
            currentTokens += paragraphTokens;
            paragraphBuffer.push(paragraph);
          } else {
            // 当前段落已满，添加到segments
            segments.push(currentSegment);

            // 开始新段落，并添加重叠部分
            // 从缓冲区中取最后几个段落作为重叠部分
            const overlapParagraphs = paragraphBuffer.slice(Math.max(0, paragraphBuffer.length - Math.ceil(SEGMENT_OVERLAP_SIZE / 250)));
            currentSegment = overlapParagraphs.join('\n\n') + '\n\n' + paragraph;
            currentTokens = countTokens(currentSegment);
            paragraphBuffer = [...overlapParagraphs, paragraph];
          }
        }

        // 添加最后一个段落
        if (currentSegment) {
          segments.push(currentSegment);
        }

        return segments;
      };

      // 分割内容
      const segments = splitIntoSegments(processedContent);
      console.log(`文档已分为 ${segments.length} 个段落进行处理`);

      // 创建进度目录，用于存储中间结果
      const progressDir = path.join(__dirname, '../../uploads/results', id, 'progress');
      if (!fs.existsSync(progressDir)) {
        fs.mkdirSync(progressDir, { recursive: true });
      }

      // 创建临时目录，用于查看分割效果
      const tempDir = path.join(__dirname, '../../uploads/temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 将分割后的内容写入临时文件，添加分割标记
      let segmentedContent = '';
      for (let i = 0; i < segments.length; i++) {
        // 添加分割标记
        segmentedContent += `\n\n<!-- ================ 段落 ${i + 1}/${segments.length} 开始 ================ -->\n\n`;
        segmentedContent += segments[i];
        segmentedContent += `\n\n<!-- ================ 段落 ${i + 1}/${segments.length} 结束 ================ -->\n\n`;
      }

      // 保存带分割标记的内容到临时文件
      const tempFilePath = path.join(tempDir, `${id}_segmented.md`);
      fs.writeFileSync(tempFilePath, segmentedContent);
      console.log(`分割后的内容已保存到: ${tempFilePath}，可用于查看分割效果`);

      // 同时保存原始内容，方便对比
      const originalTempFilePath = path.join(tempDir, `${id}_original.md`);
      fs.writeFileSync(originalTempFilePath, markdownContent);
      console.log(`原始内容已保存到: ${originalTempFilePath}`);

      // 保存处理后但未分割的内容，方便对比
      const processedTempFilePath = path.join(tempDir, `${id}_processed.md`);
      fs.writeFileSync(processedTempFilePath, processedContent);
      console.log(`处理后的内容已保存到: ${processedTempFilePath}`);

      // 保存分段信息，供前端查询进度
      const progressInfo = {
        total_segments: segments.length,
        completed_segments: 0,
        status: 'processing',
        start_time: new Date().toISOString()
      };
      fs.writeFileSync(
        path.join(progressDir, 'progress.json'),
        JSON.stringify(progressInfo, null, 2)
      );

      // 逐段处理
      let optimizedSegments = [];

      for (let i = 0; i < segments.length; i++) {
        console.log(`处理段落 ${i + 1}/${segments.length}...`);

        // 构建该段落的消息
        const segmentMessages = [
          {
            role: 'system',
            content: messages[0].content
          },
          {
            role: 'user',
            content: `${prompt}\n\n以下是从PDF提取的原始内容的第${i + 1}/${segments.length}部分，其中包含一些以__PRESERVED_开头和__结尾的占位符。这些占位符代表图片、表格和公式，请完全保留这些占位符，不要修改它们：\n\n${segments[i]}`
          }
        ];

        // 调用AI模型处理当前段落
        const optimizedSegment = await chatController.callQwenApi(segmentMessages, apiKey, apiBaseUrl, actualModelToUse, false);

        if (!optimizedSegment) {
          throw new Error(`段落 ${i + 1} 优化失败，AI模型返回的内容为空`);
        }

        optimizedSegments.push(optimizedSegment);

        // 更新进度信息
        progressInfo.completed_segments = i + 1;
        fs.writeFileSync(
          path.join(progressDir, 'progress.json'),
          JSON.stringify(progressInfo, null, 2)
        );

        // 保存当前段落的优化结果
        fs.writeFileSync(
          path.join(progressDir, `segment_${i + 1}.md`),
          optimizedSegment
        );
      }

      // 合并所有优化后的段落
      let optimizedContent = optimizedSegments.join('\n\n');
      console.log('所有段落处理完成，合并结果');
      console.log('AI模型返回内容总长度:', optimizedContent.length);

      // 更新进度信息
      progressInfo.status = 'replacing_placeholders';
      fs.writeFileSync(
        path.join(progressDir, 'progress.json'),
        JSON.stringify(progressInfo, null, 2)
      );

      // 将保留的内容插回优化后的文本
      console.log('将保留的内容插回优化后的文本...');
      preservedContent.forEach(item => {
        optimizedContent = optimizedContent.replace(item.placeholder, item.content);
      });

      // 检查是否有未替换的占位符
      const placeholderPattern = new RegExp(`__PRESERVED_[A-Z]+_${uniqueId}_\\d+__`, 'g');
      const remainingPlaceholders = optimizedContent.match(placeholderPattern);
      if (remainingPlaceholders && remainingPlaceholders.length > 0) {
        console.warn(`警告: 有 ${remainingPlaceholders.length} 个占位符未被替换`);

        // 尝试再次替换
        remainingPlaceholders.forEach(placeholder => {
          const matchingItem = preservedContent.find(item => item.placeholder === placeholder);
          if (matchingItem) {
            optimizedContent = optimizedContent.replace(placeholder, matchingItem.content);
          }
        });
      }

      // 更新进度信息
      progressInfo.status = 'completed';
      progressInfo.end_time = new Date().toISOString();
      fs.writeFileSync(
        path.join(progressDir, 'progress.json'),
        JSON.stringify(progressInfo, null, 2)
      );

      // 创建优化结果目录
      const optimizedDir = path.join(__dirname, '../../uploads/results', id, 'optimized');
      if (!fs.existsSync(optimizedDir)) {
        fs.mkdirSync(optimizedDir, { recursive: true });
      }

      // 保存优化后的内容
      const optimizedPath = path.join(optimizedDir, `${path.basename(markdownPath, '.md')}_optimized.md`);
      fs.writeFileSync(optimizedPath, optimizedContent);

      console.log('优化内容已保存到:', optimizedPath);

      // 更新数据库中的优化路径
      const relativeOptimizedPath = path.relative(path.join(__dirname, '../..'), optimizedPath);
      await connection.execute(
        'UPDATE pdf_files SET optimized_markdown_path = ? WHERE id = ?',
        [relativeOptimizedPath, id]
      );

      // 返回优化后的内容
      res.status(200).json({
        success: true,
        message: '内容优化成功',
        data: optimizedContent
      });
    } catch (error) {
      console.error('调用AI模型错误:', error);
      console.error('错误详情:', error.response?.data || error.message);

      // 检查是否是API密钥错误
      if (error.response?.data?.error?.code === 'InvalidApiKey') {
        return res.status(400).json({
          success: false,
          message: 'API密钥无效，请在API密钥管理中更新',
          error: error.message
        });
      }

      // 检查是否是配额不足
      if (error.response?.data?.error?.code === 'QuotaExceeded') {
        return res.status(400).json({
          success: false,
          message: 'API配额已用尽，请稍后再试或更新API密钥',
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        message: '调用AI模型失败: ' + (error.message || '未知错误'),
        error: error.message
      });
    }
  } finally {
    if (connection) connection.release();
    // 清理临时资源
    cleanupResources(tempDirs);
  }
};

// 获取优化进度
exports.getOptimizationProgress = async (req, res) => {
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

      // 检查进度文件是否存在
      const progressPath = path.join(__dirname, '../../uploads/results', id, 'progress', 'progress.json');

      if (!fs.existsSync(progressPath)) {
        return res.status(200).json({
          success: true,
          data: {
            status: 'not_started',
            message: '优化尚未开始'
          }
        });
      }

      // 读取进度信息
      const progressInfo = JSON.parse(fs.readFileSync(progressPath, 'utf8'));

      // 如果已完成，检查是否有优化后的内容
      if (progressInfo.status === 'completed') {
        const fileInfo = rows[0];
        if (fileInfo.optimized_markdown_path) {
          progressInfo.optimized_path = fileInfo.optimized_markdown_path;
        }
      }

      // 如果正在处理中，获取已完成段落的内容
      if (progressInfo.status === 'processing' && progressInfo.completed_segments > 0) {
        const completedSegments = [];
        for (let i = 1; i <= progressInfo.completed_segments; i++) {
          const segmentPath = path.join(__dirname, '../../uploads/results', id, 'progress', `segment_${i}.md`);
          if (fs.existsSync(segmentPath)) {
            const segmentContent = fs.readFileSync(segmentPath, 'utf8');
            completedSegments.push(segmentContent);
          }
        }

        if (completedSegments.length > 0) {
          progressInfo.completed_content = completedSegments.join('\n\n');
        }
      }

      return res.status(200).json({
        success: true,
        data: progressInfo
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('获取优化进度错误:', error);
    res.status(500).json({
      success: false,
      message: '获取优化进度失败',
      error: error.message
    });
  }
};

// 获取优化后的内容
exports.getOptimizedContent = async (req, res) => {
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

      // 检查是否有优化后的内容
      if (!fileInfo.optimized_markdown_path) {
        return res.status(404).json({
          success: false,
          message: '找不到优化后的内容'
        });
      }

      // 读取优化后的内容
      const optimizedPath = path.join(__dirname, '../..', fileInfo.optimized_markdown_path);
      if (!fs.existsSync(optimizedPath)) {
        return res.status(404).json({
          success: false,
          message: '优化后的文件不存在'
        });
      }

      const optimizedContent = fs.readFileSync(optimizedPath, 'utf8');

      // 返回优化后的内容
      res.status(200).json({
        success: true,
        data: optimizedContent
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('获取优化内容错误:', error);
    res.status(500).json({
      success: false,
      message: '获取优化内容失败',
      error: error.message
    });
  }
};



// 生成AI总结（异步处理，支持轮询进度）
exports.generateSummary = async (req, res) => {
  let connection = null;
  try {
    const { id } = req.params;

    connection = await pool.getConnection();

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

    // 检查是否有Markdown内容
    if (!fileInfo.markdown_path) {
      return res.status(404).json({
        success: false,
        message: '找不到Markdown内容，无法生成总结'
      });
    }

    // 读取Markdown内容
    const markdownPath = path.join(__dirname, '../..', fileInfo.markdown_path);
    if (!fs.existsSync(markdownPath)) {
      return res.status(404).json({
        success: false,
        message: 'Markdown文件不存在'
      });
    }

    // 创建进度目录
    const progressDir = path.join(__dirname, '../../uploads/progress/summary', id);
    if (!fs.existsSync(progressDir)) {
      fs.mkdirSync(progressDir, { recursive: true });
    }

    // 初始化进度信息
    const progressInfo = {
      status: 'starting',
      progress: 0,
      message: '正在初始化总结生成...',
      startTime: new Date().toISOString(),
      completed: false,
      error: null
    };

    // 保存初始进度
    fs.writeFileSync(
      path.join(progressDir, 'progress.json'),
      JSON.stringify(progressInfo, null, 2)
    );

    // 立即返回响应，开始异步处理
    res.status(200).json({
      success: true,
      message: '总结生成已开始，请轮询进度',
      data: {
        status: 'started',
        progressUrl: `/api/pdf/files/${id}/summary/progress`
      }
    });

    // 异步处理总结生成
    setImmediate(async () => {
      await processSummaryGeneration(id, userId, markdownPath, progressDir);
    });

  } catch (error) {
    console.error('启动总结生成错误:', error);

    return res.status(500).json({
      success: false,
      message: '启动总结生成失败: ' + (error.message || '未知错误'),
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};

// 异步处理总结生成
async function processSummaryGeneration(fileId, userId, markdownPath, progressDir) {
  let connection = null;
  try {
    console.log(`开始异步处理总结生成: ${fileId}`);

    // 更新进度：正在读取内容
    let progressInfo = {
      status: 'reading',
      progress: 10,
      message: '正在读取文档内容...',
      startTime: new Date().toISOString(),
      completed: false,
      error: null
    };

    fs.writeFileSync(
      path.join(progressDir, 'progress.json'),
      JSON.stringify(progressInfo, null, 2)
    );

    // 读取Markdown内容
    const markdownContent = fs.readFileSync(markdownPath, 'utf8');

    // 读取内容提取模板
    const templatePath = path.join(__dirname, '../../内容提取模板.md');
    if (!fs.existsSync(templatePath)) {
      throw new Error('找不到内容提取模板');
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8');

    // 更新进度：正在准备AI调用
    progressInfo = {
      status: 'preparing',
      progress: 20,
      message: '正在准备AI模型调用...',
      startTime: progressInfo.startTime,
      completed: false,
      error: null
    };

    fs.writeFileSync(
      path.join(progressDir, 'progress.json'),
      JSON.stringify(progressInfo, null, 2)
    );

    // 获取数据库连接
    connection = await pool.getConnection();

    // 获取用户的API密钥
    const [apiKeyRows] = await connection.execute(
      'SELECT api_key, api_base_url FROM api_keys WHERE user_id = ? AND model_name = ? AND is_active = 1',
      [userId, 'qwen']
    );

    if (apiKeyRows.length === 0) {
      throw new Error('未找到Qwen模型的API密钥，请在API密钥管理中添加');
    }

    const apiKey = apiKeyRows[0].api_key;
    const apiBaseUrl = apiKeyRows[0].api_base_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

    // 使用qwen-long模型
    const modelToUse = 'qwen-long';
    console.log(`使用模型: ${modelToUse} 进行专利总结`);

    // 更新进度：正在调用AI模型
    progressInfo = {
      status: 'processing',
      progress: 30,
      message: '正在调用AI模型生成总结...',
      startTime: progressInfo.startTime,
      completed: false,
      error: null
    };

    fs.writeFileSync(
      path.join(progressDir, 'progress.json'),
      JSON.stringify(progressInfo, null, 2)
    );

    // 构建消息
    const messages = [
      {
        role: 'system',
        content: '你是一个专业的专利信息提取专家，擅长从专利文档中提取关键信息，并按照指定的模板格式进行整理。'
      },
      {
        role: 'user',
        content: `请根据以下模板，从专利文档中提取关键信息，并填充到模板中。请保持模板的格式不变，只替换模板中的占位符内容。\n\n模板：\n${templateContent}\n\n专利文档内容：\n${markdownContent}`
      }
    ];

    // 调用AI模型API进行总结
    const chatController = require('./chat.controller');

    // 更新进度：AI处理中
    progressInfo = {
      status: 'ai_processing',
      progress: 50,
      message: 'AI模型正在分析文档内容...',
      startTime: progressInfo.startTime,
      completed: false,
      error: null
    };

    fs.writeFileSync(
      path.join(progressDir, 'progress.json'),
      JSON.stringify(progressInfo, null, 2)
    );

    // 调用AI模型生成总结
    const summaryContent = await chatController.callQwenApi(messages, apiKey, apiBaseUrl, modelToUse, false);

    if (!summaryContent) {
      throw new Error('生成总结失败，AI模型返回的内容为空');
    }

    // 更新进度：正在保存结果
    progressInfo = {
      status: 'saving',
      progress: 80,
      message: '正在保存总结结果...',
      startTime: progressInfo.startTime,
      completed: false,
      error: null
    };

    fs.writeFileSync(
      path.join(progressDir, 'progress.json'),
      JSON.stringify(progressInfo, null, 2)
    );

    // 创建总结结果目录
    const summaryDir = path.join(path.dirname(markdownPath), 'summary');
    if (!fs.existsSync(summaryDir)) {
      fs.mkdirSync(summaryDir, { recursive: true });
    }

    // 保存总结内容
    const summaryPath = path.join(summaryDir, `${path.basename(markdownPath, '.md')}_summary.md`);
    fs.writeFileSync(summaryPath, summaryContent);

    console.log('总结内容已保存到:', summaryPath);

    // 更新数据库中的总结路径
    const relativeSummaryPath = path.relative(path.join(__dirname, '../..'), summaryPath);
    await connection.execute(
      'UPDATE pdf_files SET summary_path = ? WHERE id = ?',
      [relativeSummaryPath, fileId]
    );

    // 更新进度：完成
    progressInfo = {
      status: 'completed',
      progress: 100,
      message: '总结生成完成！',
      startTime: progressInfo.startTime,
      endTime: new Date().toISOString(),
      completed: true,
      error: null,
      result: {
        summaryPath: relativeSummaryPath,
        content: summaryContent
      }
    };

    fs.writeFileSync(
      path.join(progressDir, 'progress.json'),
      JSON.stringify(progressInfo, null, 2)
    );

    console.log(`总结生成完成: ${fileId}`);

  } catch (error) {
    console.error('异步总结生成错误:', error);

    // 更新进度：错误
    const progressInfo = {
      status: 'error',
      progress: 0,
      message: '总结生成失败',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      completed: false,
      error: error.message
    };

    fs.writeFileSync(
      path.join(progressDir, 'progress.json'),
      JSON.stringify(progressInfo, null, 2)
    );
  } finally {
    if (connection) connection.release();
  }
}

// 获取总结生成进度
exports.getSummaryProgress = async (req, res) => {
  try {
    const { id } = req.params;

    // 使用默认用户ID 1，或者从请求中获取用户ID（如果存在）
    const userId = req.user && req.user.id ? req.user.id : 1;

    // 验证文件所有权
    const connection = await pool.getConnection();
    try {
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
    } finally {
      connection.release();
    }

    // 读取进度文件
    const progressDir = path.join(__dirname, '../../uploads/progress/summary', id);
    const progressFile = path.join(progressDir, 'progress.json');

    if (!fs.existsSync(progressFile)) {
      return res.status(404).json({
        success: false,
        message: '未找到总结生成进度信息'
      });
    }

    const progressContent = fs.readFileSync(progressFile, 'utf8');
    const progressInfo = JSON.parse(progressContent);

    res.status(200).json({
      success: true,
      data: progressInfo
    });
  } catch (error) {
    console.error('获取总结进度错误:', error);
    res.status(500).json({
      success: false,
      message: '获取总结进度失败',
      error: error.message
    });
  }
};

// 获取总结内容
exports.getSummaryContent = async (req, res) => {
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

      // 检查是否有总结内容
      if (!fileInfo.summary_path) {
        return res.status(404).json({
          success: false,
          message: '找不到总结内容'
        });
      }

      // 读取总结内容
      const summaryPath = path.join(__dirname, '../..', fileInfo.summary_path);
      if (!fs.existsSync(summaryPath)) {
        return res.status(404).json({
          success: false,
          message: '总结文件不存在'
        });
      }

      const summaryContent = fs.readFileSync(summaryPath, 'utf8');

      // 返回总结内容
      res.status(200).json({
        success: true,
        data: summaryContent
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('获取总结内容错误:', error);
    res.status(500).json({
      success: false,
      message: '获取总结内容失败',
      error: error.message
    });
  }
};

// 下载总结内容
exports.downloadSummaryContent = async (req, res) => {
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

      // 检查是否有总结内容
      if (!fileInfo.summary_path) {
        return res.status(404).json({
          success: false,
          message: '找不到总结内容'
        });
      }

      // 读取总结内容
      const summaryPath = path.join(__dirname, '../..', fileInfo.summary_path);
      if (!fs.existsSync(summaryPath)) {
        return res.status(404).json({
          success: false,
          message: '总结文件不存在'
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
      } catch (error) {
        console.error('文件名解码错误:', error);
        // 如果解码失败，使用原始文件名
      }

      // 提取原始文件名（不带扩展名）
      const fileNameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
      // 确保文件名不包含非法字符
      const safeFileName = fileNameWithoutExt.replace(/[\\/:*?"<>|]/g, '_');
      const downloadFileName = `${safeFileName}_专利总结.md`;

      // 发送文件
      res.download(summaryPath, downloadFileName);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('下载总结内容错误:', error);
    res.status(500).json({
      success: false,
      message: '下载总结内容失败',
      error: error.message
    });
  }
};

// 下载优化后的内容
exports.downloadOptimizedContent = async (req, res) => {
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

      // 检查是否有优化后的内容
      if (!fileInfo.optimized_markdown_path) {
        return res.status(404).json({
          success: false,
          message: '找不到优化后的内容'
        });
      }

      // 读取优化后的内容
      const optimizedPath = path.join(__dirname, '../..', fileInfo.optimized_markdown_path);
      if (!fs.existsSync(optimizedPath)) {
        return res.status(404).json({
          success: false,
          message: '优化后的文件不存在'
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
      } catch (error) {
        console.error('文件名解码错误:', error);
        // 如果解码失败，使用原始文件名
      }

      // 提取原始文件名（不带扩展名）
      const fileNameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
      // 确保文件名不包含非法字符
      const safeFileName = fileNameWithoutExt.replace(/[\\/:*?"<>|]/g, '_');
      const downloadFileName = `${safeFileName}_优化结果.md`;

      // 发送文件
      res.download(optimizedPath, downloadFileName);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('下载优化内容错误:', error);
    res.status(500).json({
      success: false,
      message: '下载优化内容失败',
      error: error.message
    });
  }
};

/**
 * 批量下载多个文件的结果
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.downloadMultipleResults = async (req, res) => {
  try {
    let fileIds = req.body.fileIds;
    const userId = req.user.id;

    // 处理可能的JSON字符串
    if (typeof fileIds === 'string') {
      try {
        fileIds = JSON.parse(fileIds);
      } catch (e) {
        console.error('解析fileIds失败:', e);
      }
    }

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "请提供有效的文件ID列表",
      });
    }

    // 限制一次最多下载的文件数量
    if (fileIds.length > 10) {
      return res.status(400).json({
        success: false,
        message: "一次最多只能下载10个文件",
      });
    }

    // 创建临时目录
    const batchId = uuidv4();
    const batchTempDir = path.join(os.tmpdir(), batchId);
    fs.mkdirSync(batchTempDir, { recursive: true });

    // 获取文件信息并验证所有权
    const filePromises = fileIds.map(async (fileId) => {
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.execute(
          "SELECT * FROM pdf_files WHERE id = ? AND user_id = ?",
          [fileId, userId]
        );

        if (rows.length === 0) {
          return { fileId, error: "文件不存在或无权访问" };
        }

        return { fileId, file: rows[0], error: null };
      } finally {
        connection.release();
      }
    });

    const fileResults = await Promise.all(filePromises);
    const validFiles = fileResults.filter((result) => !result.error);

    if (validFiles.length === 0) {
      fs.rmSync(batchTempDir, { recursive: true, force: true });
      return res.status(404).json({
        success: false,
        message: "没有找到有效的文件",
      });
    }

    // 为每个文件创建一个子目录
    for (const fileResult of validFiles) {
      const file = fileResult.file;

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

        // 移除任何不可打印字符和非法文件名字符
        originalFilename = originalFilename.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        originalFilename = originalFilename.replace(/[\\/:*?"<>|]/g, '_');

        // 确保文件名是有效的
        if (!originalFilename || originalFilename.trim() === '') {
          originalFilename = '未命名文件';
        }
      } catch (error) {
        console.error('文件名解码错误:', error);
        // 如果解码失败，使用原始文件名
        originalFilename = '未命名文件_' + file.id;
      }

      // 移除扩展名
      const fileNameWithoutExt = originalFilename.replace(/\.[^/.]+$/, "");
      const fileDir = path.join(batchTempDir, fileNameWithoutExt);
      fs.mkdirSync(fileDir, { recursive: true });

      // 获取文件的结果目录
      const resultsDir = path.join(__dirname, '../../uploads/results', file.id, 'auto');

      if (fs.existsSync(resultsDir)) {
        // 复制所有结果文件到批量下载目录
        const files = fs.readdirSync(resultsDir);
        for (const fileName of files) {
          const srcPath = path.join(resultsDir, fileName);
          const destPath = path.join(fileDir, fileName);

          // 如果是目录（如images目录），递归复制
          if (fs.statSync(srcPath).isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            const subFiles = fs.readdirSync(srcPath);
            for (const subFile of subFiles) {
              fs.copyFileSync(
                path.join(srcPath, subFile),
                path.join(destPath, subFile)
              );
            }
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }
    }

    // 创建批量下载的ZIP文件
    const zipFilePath = path.join(os.tmpdir(), `${batchId}_batch_download.zip`);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    // 监听错误
    archive.on("error", (err) => {
      console.error("创建ZIP文件时出错:", err);
      return res.status(500).json({
        success: false,
        message: "创建ZIP文件时出错",
      });
    });

    // 完成时发送文件
    output.on("close", () => {
      res.download(zipFilePath, "批量下载结果.zip", (err) => {
        if (err) {
          console.error("发送ZIP文件时出错:", err);
        }

        // 清理临时文件
        setTimeout(() => {
          try {
            fs.unlinkSync(zipFilePath);
            fs.rmSync(batchTempDir, { recursive: true, force: true });
          } catch (e) {
            console.error("清理临时文件时出错:", e);
          }
        }, 1000);
      });
    });

    // 将目录添加到ZIP
    archive.pipe(output);
    archive.directory(batchTempDir, false);
    archive.finalize();
  } catch (error) {
    console.error("批量下载文件时出错:", error);
    res.status(500).json({
      success: false,
      message: "批量下载文件时出错",
      error: error.message
    });
  }
};