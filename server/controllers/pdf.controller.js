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

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

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
      // console.log('pdf_files 表创建成功');
    } else {
      // console.log('pdf_files 表已存在，跳过创建');
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
      const files = rows.map(file => ({
        id: file.id,
        originalFilename: file.original_filename,
        fileType: file.file_type,
        status: file.status,
        createdAt: file.created_at,
        markdownUrl: file.markdown_path ? `${baseUrl}/${file.markdown_path}` : null,
        formulasUrl: file.formulas_path ? `${baseUrl}/${file.formulas_path}` : null,
        formulasCount: file.formulas_count
      }));

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

      // 构建响应数据
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fileDetails = {
        id: file.id,
        originalFilename: file.original_filename,
        fileType: file.file_type,
        status: file.status,
        createdAt: file.created_at,
        markdownUrl: file.markdown_path ? `${baseUrl}/${file.markdown_path}` : null,
        formulasUrl: file.formulas_path ? `${baseUrl}/${file.formulas_path}` : null,
        formulasCount: file.formulas_count
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

      const file = rows[0];

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
      const fileName = req.file.filename;
      const originalFilename = req.file.originalname;
      const fileType = path.extname(originalFilename).substring(1);

      // 获取转换选项
      const parseMethod = req.body.parseMethod || 'auto';
      const debugMode = req.body.debugMode === 'true';

      // 生成唯一ID
      const fileId = uuidv4();

      // 创建结果目录
      const resultDir = path.join(__dirname, '../../uploads/results', fileId);
      if (!fs.existsSync(resultDir)) {
        fs.mkdirSync(resultDir, { recursive: true });
      }

      console.log(`开始转换文件: ${originalFilename}, ID: ${fileId}, 解析方法: ${parseMethod}, 调试模式: ${debugMode}`);

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

        // 读取文件并转换为 base64
        const fileContent = fs.readFileSync(filePath);
        const fileBase64 = fileContent.toString('base64');

        // 发送请求到远程服务器
        console.log(`发送请求到远程服务器: ${REMOTE_SERVER_URL}`);
        const response = await axios.post(REMOTE_SERVER_URL, {
          file: fileBase64,
          kwargs: {
            debug_able: debugMode,
            parse_method: parseMethod
          },
          request_id: fileId // 使用文件ID作为请求ID
        }, {
          timeout: 300000 // 设置超时时间为5分钟
        });

        if (response.status === 200) {
          const outputDir = response.data.output_dir;
          console.log(`文件转换成功，输出目录: ${outputDir}`);

          // 从远程服务器获取 Markdown 文件
          // 确保使用正斜杠（/）作为路径分隔符，适用于Linux服务器
          const outputDirFormatted = outputDir.replace(/\\/g, '/');

          // 从请求ID中提取文件名
          const requestId = response.data.request_id;

          // 尝试多个可能的路径
          let markdownResponse = null;
          const possiblePaths = [
            `${outputDirFormatted}/auto/${requestId}.md`,     // 使用请求ID命名的文件在auto子目录
            `${outputDirFormatted}/${requestId}.md`,          // 使用请求ID命名的文件在输出目录
            `${outputDirFormatted}/auto/output.md`,           // 默认名称在auto子目录
            `${outputDirFormatted}/output.md`                 // 默认名称在输出目录
          ];

          // 依次尝试每个路径
          for (const path of possiblePaths) {
            try {
              console.log(`尝试获取Markdown文件: ${path}`);
              markdownResponse = await axios.get(`http://172.19.1.81:8010/files?path=${encodeURIComponent(path)}`, {
                responseType: 'text',
                timeout: 30000
              });

              if (markdownResponse.status === 200) {
                console.log(`成功获取Markdown文件: ${path}`);
                break;
              }
            } catch (error) {
              console.log(`无法从路径获取Markdown文件: ${path}, 错误: ${error.message}`);
            }
          }

          // 如果所有路径都失败，抛出错误
          if (!markdownResponse) {
            throw new Error('无法获取Markdown文件，所有尝试都失败');
          }

          // 保存 Markdown 文件
          const localMarkdownPath = path.join(resultDir, 'output.md');
          fs.writeFileSync(localMarkdownPath, markdownResponse.data);
          console.log(`Markdown文件已保存到: ${localMarkdownPath}`);

          // 相对路径，用于存储到数据库
          const relativeMarkdownPath = path.relative(path.join(__dirname, '../..'), localMarkdownPath);

          // 获取提取的化学式（如果有）
          let extractedFormulas = [];
          let relativeFormulasPath = null;

          try {
            // 尝试多个可能的路径获取化学式文件
            let formulasResponse = null;
            const possibleFormulaPaths = [
              `${outputDirFormatted}/auto/${requestId}_content_list.json`,  // 使用请求ID命名的内容列表文件
              `${outputDirFormatted}/auto/formulas.json`,                   // 默认名称在auto子目录
              `${outputDirFormatted}/formulas.json`                         // 默认名称在输出目录
            ];

            // 依次尝试每个路径
            for (const path of possibleFormulaPaths) {
              try {
                console.log(`尝试获取化学式文件: ${path}`);
                formulasResponse = await axios.get(`http://172.19.1.81:8010/files?path=${encodeURIComponent(path)}`, {
                  responseType: 'json',
                  timeout: 30000
                });

                if (formulasResponse.status === 200) {
                  console.log(`成功获取化学式文件: ${path}`);
                  break;
                }
              } catch (error) {
                console.log(`无法从路径获取化学式文件: ${path}, 错误: ${error.message}`);
              }
            }

            // 如果所有路径都失败，则认为没有化学式文件
            if (!formulasResponse) {
              console.log('未找到化学式文件，所有尝试都失败');
              return;
            }

            if (formulasResponse.data) {
              extractedFormulas = formulasResponse.data;
              console.log(`成功获取化学式: ${extractedFormulas.length}个`);

              // 保存化学式文件
              const localFormulasPath = path.join(resultDir, 'formulas.json');
              fs.writeFileSync(localFormulasPath, JSON.stringify(formulasResponse.data, null, 2));
              console.log(`化学式文件已保存到: ${localFormulasPath}`);

              // 相对路径，用于存储到数据库
              relativeFormulasPath = path.relative(path.join(__dirname, '../..'), localFormulasPath);
            }
          } catch (error) {
            console.log('获取化学式文件失败，可能不存在:', error.message);
          }

          // 更新数据库中的文件信息
          const connection = await pool.getConnection();
          try {
            await connection.execute(
              'UPDATE pdf_files SET status = ?, markdown_path = ?, formulas_path = ?, formulas_count = ? WHERE id = ?',
              ['completed', relativeMarkdownPath, relativeFormulasPath, extractedFormulas.length, fileId]
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
              markdownUrl: `${baseUrl}/uploads/results/${fileId}/output.md`,
              formulasUrl: extractedFormulas.length > 0 ? `${baseUrl}/uploads/results/${fileId}/formulas.json` : null,
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
