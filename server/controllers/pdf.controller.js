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

// 远程服务器配置
const REMOTE_SERVER_URL = 'http://172.19.1.81:8010/predict';
const REMOTE_SERVER_BASE_URL = 'http://172.19.1.81:8010';

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
async function downloadRemoteDirectory(remotePath, localPath, originalFilename = null) {
  // 创建本地目录
  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
  }

  try {
    console.log(`获取远程目录列表: ${remotePath}`);
    // 获取远程目录列表
    const response = await axios.get(`${REMOTE_SERVER_BASE_URL}/files/list?path=${encodeURIComponent(remotePath)}`, {
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
    for (const file of files) {
      const remoteFilePath = `${remotePath}/${file.name}`;
      let localFileName = file.name;

      // 如果有原始文件名，并且是特定类型的文件，使用更友好的名称
      if (originalFilename) {
        const fileExt = path.extname(file.name);
        const fileBaseName = path.basename(file.name, fileExt);
        const originalNameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');

        // 为特定类型的文件使用更友好的名称
        if (fileExt.toLowerCase() === '.md') {
          // 如果是Markdown文件，使用原始文件名
          if (fileBaseName === requestId || fileBaseName === 'output') {
            localFileName = `${originalNameWithoutExt}${fileExt}`;
          }
        } else if (fileExt.toLowerCase() === '.pdf') {
          // 如果是PDF文件，使用原始文件名加后缀
          localFileName = `${originalNameWithoutExt}_转换结果${fileExt}`;
        } else if (fileBaseName.includes('content_list') && fileExt.toLowerCase() === '.json') {
          // 如果是化学式文件，使用原始文件名加后缀
          localFileName = `${originalNameWithoutExt}_化学式${fileExt}`;
        }
      }

      const localFilePath = path.join(localPath, localFileName);

      if (file.isDirectory) {
        // 递归下载子目录
        console.log(`下载子目录: ${remoteFilePath}`);
        await downloadRemoteDirectory(remoteFilePath, localFilePath, originalFilename);
      } else {
        // 下载文件
        try {
          console.log(`下载文件: ${remoteFilePath}`);
          const fileResponse = await axios.get(`${REMOTE_SERVER_BASE_URL}/files?path=${encodeURIComponent(remoteFilePath)}`, {
            responseType: 'arraybuffer',
            timeout: 60000 // 设置较长的超时时间，以处理大文件
          });

          fs.writeFileSync(localFilePath, fileResponse.data);
          console.log(`文件已保存: ${localFilePath} (原始文件: ${file.name})`);
        } catch (error) {
          console.error(`下载文件失败: ${remoteFilePath}, 错误: ${error.message}`);
          // 继续下载其他文件，不中断整个过程
        }
      }
    }

    return true;
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
    // console.log('测试与远程服务器的连接...');
    const response = await axios.get('http://172.19.1.81:8010/ping');

    if (response.status === 200 && response.data.status === 'ok') {
      // console.log('远程服务器连接成功:', response.data);
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
          // 确保文件名正确显示
          const decodedFilename = Buffer.from(originalFilename, 'binary').toString('utf8');
          if (decodedFilename !== originalFilename && /[^\x00-\x7F]/.test(decodedFilename)) {
            originalFilename = decodedFilename;
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
        // 确保文件名正确显示
        const decodedFilename = Buffer.from(originalFilename, 'binary').toString('utf8');
        if (decodedFilename !== originalFilename && /[^\x00-\x7F]/.test(decodedFilename)) {
          originalFilename = decodedFilename;
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
        // 确保文件名正确显示
        const decodedFilename = Buffer.from(originalFilename, 'binary').toString('utf8');
        if (decodedFilename !== originalFilename && /[^\x00-\x7F]/.test(decodedFilename)) {
          originalFilename = decodedFilename;
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
        // 确保文件名正确显示
        const decodedFilename = Buffer.from(originalFilename, 'binary').toString('utf8');
        if (decodedFilename !== originalFilename && /[^\x00-\x7F]/.test(decodedFilename)) {
          originalFilename = decodedFilename;
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
        // 确保文件名正确显示
        const decodedFilename = Buffer.from(originalFilename, 'binary').toString('utf8');
        if (decodedFilename !== originalFilename && /[^\x00-\x7F]/.test(decodedFilename)) {
          originalFilename = decodedFilename;
          // 更新fileInfo对象，以便后续使用
          fileInfo.original_filename = originalFilename;
        }
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

      // 创建临时ZIP文件
      const zipFilePath = path.join(require('os').tmpdir(), `${fileInfo.id}_results.zip`);

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

          // 构建更友好的文件名
          const fileNameWithoutExt = fileInfo.original_filename.replace(/\.[^/.]+$/, '');
          const downloadFileName = `${fileNameWithoutExt}_结果文件.zip`;

          // 发送ZIP文件
          res.download(zipFilePath, downloadFileName, () => {
            // 下载完成后删除临时文件
            if (fs.existsSync(zipFilePath)) {
              fs.unlinkSync(zipFilePath);
            }
          });
        } catch (error) {
          console.error('更新下载信息错误:', error);
          // 构建更友好的文件名
          const fileNameWithoutExt = fileInfo.original_filename.replace(/\.[^/.]+$/, '');
          const downloadFileName = `${fileNameWithoutExt}_结果文件.zip`;

          // 仍然发送文件
          res.download(zipFilePath, downloadFileName, () => {
            if (fs.existsSync(zipFilePath)) {
              fs.unlinkSync(zipFilePath);
            }
          });
        }
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

      // 获取原始文件名（不带扩展名）
      const fileNameWithoutExt = fileInfo.original_filename.replace(/\.[^/.]+$/, '');

      // 手动添加文件到归档，以便自定义文件名
      const addFilesToArchive = (dir, baseInZip = '') => {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            // 如果是目录，递归处理
            addFilesToArchive(fullPath, path.join(baseInZip, item));
          } else {
            // 如果是文件，添加到归档
            const fileExt = path.extname(item);
            const fileBaseName = path.basename(item, fileExt);

            // 为特定类型的文件使用更友好的名称
            let zipPath;
            if (fileExt.toLowerCase() === '.md') {
              // Markdown文件使用原始文件名
              zipPath = path.join(baseInZip, `${fileNameWithoutExt}${fileExt}`);
            } else if (fileExt.toLowerCase() === '.pdf') {
              // PDF文件使用原始文件名
              zipPath = path.join(baseInZip, `${fileNameWithoutExt}_转换结果${fileExt}`);
            } else if (fileBaseName.includes('content_list') && fileExt.toLowerCase() === '.json') {
              // 化学式文件使用原始文件名
              zipPath = path.join(baseInZip, `${fileNameWithoutExt}_化学式${fileExt}`);
            } else {
              // 其他文件保持原样
              zipPath = path.join(baseInZip, item);
            }

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
      // 如果文件名包含非ASCII字符，确保正确编码
      if (/[^\x00-\x7F]/.test(originalFilename)) {
        try {
          // 尝试使用Buffer处理编码问题
          const buffer = Buffer.from(originalFilename, 'binary');
          originalFilename = buffer.toString('utf8');
        } catch (error) {
          console.error('文件名编码转换错误:', error);
          // 如果转换失败，使用原始文件名
        }
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
        const connection = await pool.getConnection();
        try {
          // 使用默认用户ID 1，或者从请求中获取用户ID（如果存在）
          const userId = req.user && req.user.id ? req.user.id : 1;

          await connection.execute(
            'INSERT INTO pdf_files (id, user_id, original_filename, file_type, status) VALUES (?, ?, ?, ?, ?)',
            [fileId, userId, originalFilename, fileType, 'processing']
          );
          console.log(`文件信息已保存到数据库: ${fileId}`);
        } finally {
          connection.release();
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

        // 发送请求到远程服务器
        console.log(`发送请求到远程服务器: ${REMOTE_SERVER_URL}`);
        const response = await axios.post(REMOTE_SERVER_URL, {
          file: fileBase64,
          kwargs: {
            // PDF转换不涉及化学公式，使用默认参数
            debug_able: false
          },
          request_id: fileId // 使用文件ID作为请求ID
        }, {
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
          const requestId = response.data.request_id;

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
          const connection = await pool.getConnection();
          try {
            await connection.execute(
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
            connection.release();
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
