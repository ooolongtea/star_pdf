const Patent = require('../models/patent.model');
const User = require('../models/user.model');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const rimraf = promisify(require('rimraf'));
const extract = require('extract-zip');
// 导入化学式提取客户端工具
const chemicalClient = require('../utils/chemical_client');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/patents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 限制50MB
  fileFilter: (req, file, cb) => {
    // 允许PDF文件和ZIP文件
    if (file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传PDF文件或ZIP文件'), false);
    }
  }
}).single('patent');

// 上传专利文件
exports.uploadPatent = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传文件'
        });
      }

      const { title, patentNumber, description, isDirectory, isBatchMode } = req.body;

      // 如果没有提供标题，使用文件名作为标题
      let patentTitle = title;
      if (!patentTitle) {
        // 从文件名中提取标题
        const originalName = req.file.originalname;
        // 移除扩展名
        patentTitle = path.parse(originalName).name;
        console.log(`使用文件名作为专利标题: ${patentTitle}`);
      }

      // 记录上传信息
      console.log('上传文件信息:', {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        isDirectory: isDirectory === 'true',
        isBatchMode: isBatchMode === 'true'
      });

      const patentModel = new Patent(req.db);
      const newPatent = await patentModel.create({
        userId: req.user.id,
        title: patentTitle,
        patentNumber: patentNumber || null,
        description: description || null,
        filePath: req.file.path,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        isDirectory: isDirectory === 'true',
        isBatchMode: isBatchMode === 'true',
        status: 'pending'
      });

      // 生成任务ID
      const taskId = uuidv4();

      // 获取用户的API设置
      const [settingsRows] = await req.db.execute(
        'SELECT * FROM settings WHERE user_id = ?',
        [req.user.id]
      );

      const settings = settingsRows[0] || {
        server_url: 'http://172.19.1.81:8010',
        chemical_extraction_server_url: 'http://172.19.1.81:8011',
        remote_mode: true,
        username: 'user',
        password: 'password'
      };

      // 创建任务记录
      await patentModel.createTask(req.user.id, newPatent.id, taskId);

      // 更新专利状态为处理中
      await patentModel.updateStatus(newPatent.id, 'processing');

      // 启动异步处理
      processPatentAsync(req.db, newPatent, taskId, settings);

      res.status(201).json({
        success: true,
        message: '专利文件上传成功并开始处理',
        data: {
          patent: {
            id: newPatent.id,
            title: newPatent.title,
            patentNumber: newPatent.patentNumber,
            description: newPatent.description,
            fileSize: newPatent.fileSize,
            status: 'processing',
            createdAt: new Date()
          },
          taskId: taskId
        }
      });
    } catch (error) {
      console.error('上传专利错误:', error);
      res.status(500).json({
        success: false,
        message: '上传专利过程中发生错误',
        error: error.message
      });
    }
  });
};

// 获取用户的专利列表
exports.getPatents = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const patentModel = new Patent(req.db);

    const result = await patentModel.findByUserId(
      req.user.id,
      parseInt(page),
      parseInt(limit),
      status
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取专利列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取专利列表过程中发生错误',
      error: error.message
    });
  }
};

// 获取专利详情
exports.getPatentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const patentModel = new Patent(req.db);

    const patent = await patentModel.findById(id, req.user.id);
    if (!patent) {
      return res.status(404).json({
        success: false,
        message: '专利不存在或无权访问'
      });
    }

    // 获取分子和反应数据
    const molecules = await patentModel.getMolecules(id);
    const reactions = await patentModel.getReactions(id);

    res.status(200).json({
      success: true,
      data: {
        patent,
        molecules: molecules.molecules,
        moleculesTotal: molecules.pagination.total,
        reactions: reactions.reactions,
        reactionsTotal: reactions.pagination.total
      }
    });
  } catch (error) {
    console.error('获取专利详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取专利详情过程中发生错误',
      error: error.message
    });
  }
};

// 删除专利
exports.deletePatent = async (req, res) => {
  try {
    const { id } = req.params;
    const patentModel = new Patent(req.db);

    const success = await patentModel.delete(id, req.user.id);
    if (!success) {
      return res.status(404).json({
        success: false,
        message: '专利不存在或无权删除'
      });
    }

    res.status(200).json({
      success: true,
      message: '专利已成功删除'
    });
  } catch (error) {
    console.error('删除专利错误:', error);
    res.status(500).json({
      success: false,
      message: '删除专利过程中发生错误',
      error: error.message
    });
  }
};

// 处理专利提取
exports.processPatent = async (req, res) => {
  try {
    const { id } = req.params;
    const patentModel = new Patent(req.db);

    // 检查专利是否存在
    const patent = await patentModel.findById(id, req.user.id);
    if (!patent) {
      return res.status(404).json({
        success: false,
        message: '专利不存在或无权访问'
      });
    }

    // 获取用户的API设置
    const [settingsRows] = await req.db.execute(
      'SELECT * FROM settings WHERE user_id = ?',
      [req.user.id]
    );

    const settings = settingsRows[0] || {
      server_url: 'http://172.19.1.81:8010',
      chemical_extraction_server_url: 'http://172.19.1.81:8011',
      remote_mode: true,
      username: 'user',
      password: 'password'
    };

    console.log('使用的服务器设置:', {
      server_url: settings.server_url,
      chemical_extraction_server_url: settings.chemical_extraction_server_url,
      remote_mode: settings.remote_mode
    });

    // 测试与化学式提取服务器的连接
    const chemicalClient = require('../utils/chemical_client');
    const serverUrl = settings.chemical_extraction_server_url || 'http://172.19.1.81:8011';

    try {
      const isConnected = await chemicalClient.testConnection(serverUrl);
      if (!isConnected) {
        return res.status(400).json({
          success: false,
          message: '无法连接到化学式提取服务器，请检查服务器设置或稍后重试'
        });
      }
    } catch (connectionError) {
      console.error('连接化学式提取服务器失败:', connectionError);
      return res.status(400).json({
        success: false,
        message: `连接化学式提取服务器失败: ${connectionError.message}`
      });
    }

    // 生成任务ID
    const taskId = uuidv4();

    // 创建任务记录
    await patentModel.createTask(req.user.id, patent.id, taskId);

    // 更新专利状态为处理中
    await patentModel.updateStatus(patent.id, 'processing');

    // 启动异步处理
    processPatentAsync(req.db, patent, taskId, settings);

    res.status(200).json({
      success: true,
      message: '专利处理已开始',
      data: {
        taskId,
        patentId: patent.id
      }
    });
  } catch (error) {
    console.error('处理专利错误:', error);
    res.status(500).json({
      success: false,
      message: '处理专利过程中发生错误',
      error: error.message
    });
  }
};

// 异步处理专利
async function processPatentAsync(db, patent, taskId, settings) {
  const patentModel = new Patent(db);

  try {
    // 更新任务状态为运行中
    await patentModel.updateTask(taskId, {
      status: 'running',
      progress: 0,
      message: '正在准备处理专利'
    });

    // 创建临时目录
    const tempDir = path.join(__dirname, '../../uploads/temp', taskId);
    await mkdir(tempDir, { recursive: true });

    // 复制专利文件到临时目录
    const patentFilename = path.basename(patent.file_path);
    const tempPatentPath = path.join(tempDir, patentFilename);
    fs.copyFileSync(patent.file_path, tempPatentPath);

    // 更新任务进度
    await patentModel.updateTask(taskId, {
      progress: 10,
      message: '正在连接到提取服务器'
    });

    // 准备API请求
    const formData = new FormData();

    // 根据文件类型和处理模式选择不同的处理方式
    if (patent.is_directory === 1 || patent.file_type === 'application/zip' || patent.file_type === 'application/x-zip-compressed' || patentFilename.endsWith('.zip')) {
      console.log('处理ZIP文件或目录:', {
        patentId: patent.id,
        isDirectory: patent.is_directory === 1,
        isBatchMode: patent.is_batch_mode === 1,
        fileType: patent.file_type
      });

      // 如果是ZIP文件或目录，使用patent_folder参数
      formData.append('patent_folder', fs.createReadStream(tempPatentPath));
      // 设置批处理模式
      formData.append('batch_mode', patent.is_batch_mode === 1 ? 'true' : 'false');
    } else {
      // 如果是PDF文件，使用patent_file参数
      formData.append('patent_file', fs.createReadStream(tempPatentPath));
    }

    // 发送到远程API
    // 对于化学式提取，我们应该使用chemical_extraction_server_url
    console.log(`发送请求到化学式提取服务器: ${settings.chemical_extraction_server_url}/api/upload_and_process_alt`);
    console.log('请求头:', {
      ...formData.getHeaders(),
      'Authorization': 'Basic ******' // 隐藏实际凭据
    });

    // 声明API响应变量
    let apiResponse;

    try {
      // 直接使用化学式提取服务器
      const response = await axios.post(
        `${settings.chemical_extraction_server_url}/api/upload_and_process_alt`,
        formData,
        {
          headers: {
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 900000 // 15分钟超时
        }
      );

      console.log('化学式提取服务器响应状态:', response.status);
      console.log('化学式提取服务器响应数据:', response.data);

      apiResponse = response; // 保存响应对象
    } catch (apiError) {
      console.error('化学式提取服务器请求错误:', apiError.message);
      if (apiError.response) {
        console.error('错误响应状态:', apiError.response.status);
        console.error('错误响应数据:', apiError.response.data);
      } else if (apiError.request) {
        console.error('未收到响应，请求详情:', apiError.request);
      }

      // 尝试使用备用API
      console.log(`尝试备用API: ${settings.chemical_extraction_server_url}/api/upload_and_process`);

      try {
        const altResponse = await axios.post(
          `${settings.chemical_extraction_server_url}/api/upload_and_process`,
          formData,
          {
            headers: {
              ...formData.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 300000 // 5分钟超时
          }
        );

        console.log('备用API响应状态:', altResponse.status);
        console.log('备用API响应数据:', altResponse.data);

        apiResponse = altResponse; // 保存响应对象
      } catch (altApiError) {
        console.error('备用API请求错误:', altApiError.message);
        if (altApiError.response) {
          console.error('备用错误响应状态:', altApiError.response.status);
          console.error('备用错误响应数据:', altApiError.response.data);
        }

        // 如果备用API也失败，尝试使用MinerU服务器
        console.log(`尝试MinerU服务器: ${settings.server_url}/api/process_patent`);

        try {
          const mineruResponse = await axios.post(
            `${settings.server_url}/api/process_patent`,
            formData,
            {
              headers: {
                ...formData.getHeaders(),
                'Authorization': `Basic ${Buffer.from(`${settings.username}:${settings.password}`).toString('base64')}`
              },
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
              timeout: 300000 // 5分钟超时
            }
          );

          console.log('MinerU服务器响应状态:', mineruResponse.status);
          console.log('MinerU服务器响应数据:', mineruResponse.data);

          apiResponse = mineruResponse; // 保存响应对象
        } catch (mineruError) {
          console.error('MinerU服务器请求错误:', mineruError.message);
          throw new Error('所有API请求都失败，无法处理专利');
        }
      }
    }

    // 检查响应
    if (!apiResponse || !apiResponse.data || !apiResponse.data.success) {
      throw new Error((apiResponse && apiResponse.data && apiResponse.data.message) || '处理失败');
    }

    // 更新任务进度
    await patentModel.updateTask(taskId, {
      progress: 50,
      message: '正在下载处理结果'
    });

    // 下载结果
    let resultsPath = null;
    let downloadUrl = null;

    // 从响应中获取结果路径和下载URL
    if (apiResponse.data.download_url) {
      // 检查download_url是否是完整URL，如果不是，添加服务器基础URL
      if (apiResponse.data.download_url.startsWith('http')) {
        downloadUrl = apiResponse.data.download_url;
      } else {
        downloadUrl = `${settings.chemical_extraction_server_url}${apiResponse.data.download_url}`;
      }
      console.log(`使用返回的下载URL: ${downloadUrl}`);
    }

    // 确定结果路径，优先使用output_dir，其次是results_path，再次是download_path，最后是patent_dir
    if (apiResponse.data.output_dir) {
      resultsPath = apiResponse.data.output_dir;
      console.log(`使用返回的output_dir作为结果路径: ${resultsPath}`);
    } else if (apiResponse.data.results_path) {
      resultsPath = apiResponse.data.results_path;
      console.log(`使用返回的results_path作为结果路径: ${resultsPath}`);
    } else if (apiResponse.data.download_path) {
      resultsPath = apiResponse.data.download_path;
      console.log(`使用返回的download_path作为结果路径: ${resultsPath}`);
    } else if (apiResponse.data.patent_dir) {
      resultsPath = apiResponse.data.patent_dir;
      console.log(`使用返回的patent_dir作为结果路径: ${resultsPath}`);
    } else {
      throw new Error('未找到结果路径');
    }

    // 优先使用化学式提取服务器下载
    console.log(`尝试从化学式提取服务器下载结果，路径: ${resultsPath}`);

    let resultsResponse;
    try {
      // 如果有下载URL，优先使用
      if (downloadUrl) {
        console.log(`使用返回的下载URL: ${downloadUrl}`);
        resultsResponse = await axios.get(
          downloadUrl,
          {
            responseType: 'arraybuffer',
            timeout: 300000 // 5分钟超时
          }
        );
      } else {
        // 使用POST请求避免URL编码问题
        console.log(`使用POST请求下载目录: ${settings.chemical_extraction_server_url}/api/download_directory`);
        resultsResponse = await axios.post(
          `${settings.chemical_extraction_server_url}/api/download_directory`,
          { dir_path: resultsPath },
          {
            responseType: 'arraybuffer',
            timeout: 300000, // 5分钟超时
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }

      console.log('下载响应状态:', resultsResponse.status);
      console.log('下载响应内容类型:', resultsResponse.headers['content-type']);
      console.log('下载响应内容长度:', resultsResponse.data.length);
    } catch (downloadError) {
      console.error('下载结果错误:', downloadError.message);

      // 尝试备用下载方法1 - 使用GET请求但对路径进行特殊处理
      try {
        // 对路径进行双重编码以处理中文字符
        const encodedPath = encodeURIComponent(encodeURIComponent(resultsPath));
        console.log(`尝试备用下载方法1 (双重编码): ${settings.chemical_extraction_server_url}/api/download_directory?dir_path=${encodedPath}`);

        resultsResponse = await axios.get(
          `${settings.chemical_extraction_server_url}/api/download_directory?dir_path=${encodedPath}`,
          {
            responseType: 'arraybuffer',
            timeout: 300000 // 5分钟超时
          }
        );

        console.log('备用下载方法1响应状态:', resultsResponse.status);
        console.log('备用下载方法1响应内容类型:', resultsResponse.headers['content-type']);
        console.log('备用下载方法1响应内容长度:', resultsResponse.data.length);
      } catch (altDownloadError1) {
        console.error('备用下载方法1错误:', altDownloadError1.message);

        // 尝试备用下载方法2 - 使用ZIP下载API的POST请求
        try {
          console.log(`尝试备用下载方法2 (ZIP POST): ${settings.chemical_extraction_server_url}/api/download_zip`);
          resultsResponse = await axios.post(
            `${settings.chemical_extraction_server_url}/api/download_zip`,
            { dir_path: resultsPath },
            {
              responseType: 'arraybuffer',
              timeout: 300000, // 5分钟超时
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          console.log('备用下载方法2响应状态:', resultsResponse.status);
          console.log('备用下载方法2响应内容类型:', resultsResponse.headers['content-type']);
          console.log('备用下载方法2响应内容长度:', resultsResponse.data.length);
        } catch (altDownloadError2) {
          console.error('备用下载方法2错误:', altDownloadError2.message);

          // 尝试备用下载方法3 - 使用原始的GET请求但不编码
          try {
            console.log(`尝试备用下载方法3 (不编码): ${settings.chemical_extraction_server_url}/api/download_directory?dir_path=${resultsPath}`);
            resultsResponse = await axios.get(
              `${settings.chemical_extraction_server_url}/api/download_directory?dir_path=${resultsPath}`,
              {
                responseType: 'arraybuffer',
                timeout: 300000 // 5分钟超时
              }
            );

            console.log('备用下载方法3响应状态:', resultsResponse.status);
            console.log('备用下载方法3响应内容类型:', resultsResponse.headers['content-type']);
            console.log('备用下载方法3响应内容长度:', resultsResponse.data.length);
          } catch (altDownloadError3) {
            console.error('备用下载方法3错误:', altDownloadError3.message);

            // 最后尝试使用MinerU服务器
            console.log(`尝试使用MinerU服务器下载: ${settings.server_url}/api/download_file?file_path=${encodeURIComponent(resultsPath)}`);

            try {
              resultsResponse = await axios.get(
                `${settings.server_url}/api/download_file?file_path=${encodeURIComponent(resultsPath)}`,
                {
                  responseType: 'arraybuffer',
                  headers: {
                    'Authorization': `Basic ${Buffer.from(`${settings.username}:${settings.password}`).toString('base64')}`
                  },
                  timeout: 300000 // 5分钟超时
                }
              );

              console.log('MinerU下载响应状态:', resultsResponse.status);
              console.log('MinerU下载响应内容类型:', resultsResponse.headers['content-type']);
              console.log('MinerU下载响应内容长度:', resultsResponse.data.length);
            } catch (mineruDownloadError) {
              console.error('MinerU下载方法错误:', mineruDownloadError.message);
              throw new Error('所有下载方法都失败，无法获取处理结果');
            }
          }
        }
      }
    }

    // 保存结果 - 统一使用uploads/patents/{专利ID}目录
    const resultsDir = path.join(__dirname, '../../uploads/patents', patent.id.toString());
    await mkdir(resultsDir, { recursive: true });

    const resultsZipPath = path.join(resultsDir, 'results.zip');
    await writeFile(resultsZipPath, resultsResponse.data);

    // 解压结果
    await extract(resultsZipPath, { dir: resultsDir });

    // 更新任务进度
    await patentModel.updateTask(taskId, {
      progress: 80,
      message: '正在解析结果数据'
    });

    // 读取分子和反应数据
    const molecules = [];
    const reactions = [];

    // 读取分子数据
    const moleculesDir = path.join(resultsDir, 'image_results');
    if (fs.existsSync(moleculesDir)) {
      const files = fs.readdirSync(moleculesDir);
      for (const file of files) {
        if (file.endsWith('_image_results.json')) {
          const data = JSON.parse(fs.readFileSync(path.join(moleculesDir, file), 'utf8'));
          if (data.molecules && data.molecules.length > 0) {
            data.molecules.forEach(mol => {
              molecules.push({
                image_id: data.image_id,
                compound_smiles: mol.compound_smiles,
                compound_name: mol.compound_name,
                coref: mol.coref,
                image_path: data.image_path,
                // 从image_path中提取文件名
                visualization_path: (() => {
                  // 提取文件名
                  const pathParts = data.image_path.split('/');
                  const fileName = pathParts[pathParts.length - 1];
                  // 提取基本文件名（不含扩展名）
                  const baseFileName = fileName.replace(/\.[^/.]+$/, "");
                  // 构建可视化路径
                  return data.image_path.replace('/image/', '/image_visualizations/').replace(fileName, `${baseFileName}_visualization_0.png`);
                })()
              });
            });
          }
        }
      }
    }

    // 读取反应数据
    // 从image_results目录下的JSON文件中读取反应数据
    const imageResultsDir = path.join(resultsDir, 'image_results');
    if (fs.existsSync(imageResultsDir)) {
      console.log(`从image_results目录读取反应数据: ${imageResultsDir}`);
      const files = fs.readdirSync(imageResultsDir);
      for (const file of files) {
        if (file.endsWith('_image_results.json')) {
          const data = JSON.parse(fs.readFileSync(path.join(imageResultsDir, file), 'utf8'));
          if (data.reactions && data.reactions.length > 0) {
            // console.log(`发现反应数据: ${file}, 反应数量: ${data.reactions.length}`);
            data.reactions.forEach(rxn => {
              // console.log(`反应数据: image_id=${data.image_id}, reaction_id=${rxn.reaction_id}, image_path=${rxn.image_path}`);
              // 使用严格的比较，确保reaction_id=0也能正确保存
              const reactionId = rxn.reaction_id !== undefined ? rxn.reaction_id : null;

              reactions.push({
                image_id: data.image_id,
                reaction_id: reactionId,
                reactants_smiles: rxn.reactants_smiles,
                product_smiles: rxn.product_smiles,
                product_coref: rxn.product_coref,
                conditions: rxn.condition,
                image_path: rxn.image_path
              });
            });
          }
        }
      }
    }

    // 保存到数据库
    if (molecules.length > 0) {
      await patentModel.saveMolecules(patent.id, molecules);
    }

    if (reactions.length > 0) {
      await patentModel.saveReactions(patent.id, reactions);
    }

    // 更新专利状态为已完成
    await patentModel.updateStatus(patent.id, 'completed');

    // 更新任务状态为已完成
    await patentModel.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      message: `处理完成，发现${molecules.length}个分子和${reactions.length}个反应`,
      resultsPath: resultsDir // 保存结果路径，方便下载
    });

    // 清理临时目录
    await rimraf(tempDir);
  } catch (error) {
    console.error('异步处理专利错误:', error);

    // 更新专利状态为失败
    await patentModel.updateStatus(patent.id, 'failed');

    // 更新任务状态为失败
    await patentModel.updateTask(taskId, {
      status: 'failed',
      progress: 0,
      message: '处理失败',
      error: error.message
    });

    // 清理临时目录
    try {
      await rimraf(path.join(__dirname, '../../uploads/temp', taskId));
    } catch (cleanupError) {
      console.error('清理临时目录错误:', cleanupError);
    }
  }
}

// 获取任务状态
exports.getTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const patentModel = new Patent(req.db);

    const task = await patentModel.getTask(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    // 检查是否是当前用户的任务
    if (task.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '无权访问此任务'
      });
    }

    // 添加推荐的轮询间隔，帮助客户端优化请求频率
    const recommendedPollInterval = task.status === 'running' ? 5 : 10; // 运行中5秒，其他状态10秒

    res.status(200).json({
      success: true,
      data: {
        task,
        recommendedPollInterval // 添加推荐的轮询间隔（秒）
      }
    });
  } catch (error) {
    console.error('获取任务状态错误:', error);
    res.status(500).json({
      success: false,
      message: '获取任务状态过程中发生错误',
      error: error.message
    });
  }
};

// 获取用户的任务列表
exports.getTasks = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const patentModel = new Patent(req.db);

    const result = await patentModel.getUserTasks(
      req.user.id,
      parseInt(page),
      parseInt(limit),
      status
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取任务列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取任务列表过程中发生错误',
      error: error.message
    });
  }
};

// 下载专利结果
exports.downloadPatentResults = async (req, res) => {
  try {
    const { id } = req.params;
    const patentModel = new Patent(req.db);

    // 检查专利是否存在
    const patent = await patentModel.findById(id, req.user.id);
    if (!patent) {
      return res.status(404).json({
        success: false,
        message: '专利不存在或无权访问'
      });
    }

    // 检查专利是否已处理完成
    if (patent.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: '专利尚未处理完成，无法下载结果'
      });
    }

    // 构建结果文件路径 - 统一使用uploads/patents/{专利ID}目录
    const resultsDir = path.join(__dirname, '../../uploads/patents', patent.id.toString());
    const resultsZipPath = path.join(resultsDir, 'results.zip');

    // 检查结果文件是否存在
    if (!fs.existsSync(resultsZipPath)) {
      return res.status(404).json({
        success: false,
        message: '结果文件不存在'
      });
    }

    // 设置响应头
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${patent.title}_results.zip"`);

    // 发送文件
    const fileStream = fs.createReadStream(resultsZipPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('下载专利结果错误:', error);
    res.status(500).json({
      success: false,
      message: '下载专利结果过程中发生错误',
      error: error.message
    });
  }
};

// 批量处理专利
exports.processBatchPatents = async (req, res) => {
  try {
    const { patentIds } = req.body;

    if (!patentIds || !Array.isArray(patentIds) || patentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的专利ID列表'
      });
    }

    const patentModel = new Patent(req.db);
    const batchId = uuidv4();
    const results = [];
    const errors = [];

    // 获取用户的API设置
    const [settingsRows] = await req.db.execute(
      'SELECT * FROM settings WHERE user_id = ?',
      [req.user.id]
    );

    const settings = settingsRows[0] || {
      server_url: 'http://172.19.1.81:8010',
      chemical_extraction_server_url: 'http://172.19.1.81:8011',
      remote_mode: true,
      username: 'user',
      password: 'password'
    };

    console.log('批量处理使用的服务器设置:', {
      server_url: settings.server_url,
      chemical_extraction_server_url: settings.chemical_extraction_server_url,
      remote_mode: settings.remote_mode
    });

    // 测试与化学式提取服务器的连接
    const chemicalClient = require('../utils/chemical_client');
    const serverUrl = settings.chemical_extraction_server_url || 'http://172.19.1.81:8011';

    try {
      const isConnected = await chemicalClient.testConnection(serverUrl);
      if (!isConnected) {
        return res.status(400).json({
          success: false,
          message: '无法连接到化学式提取服务器，请检查服务器设置或稍后重试'
        });
      }
    } catch (connectionError) {
      console.error('连接化学式提取服务器失败:', connectionError);
      return res.status(400).json({
        success: false,
        message: `连接化学式提取服务器失败: ${connectionError.message}`
      });
    }

    // 处理每个专利
    for (const patentId of patentIds) {
      try {
        // 检查专利是否存在
        const patent = await patentModel.findById(patentId, req.user.id);
        if (!patent) {
          errors.push({
            patentId,
            message: '专利不存在或无权访问'
          });
          continue;
        }

        // 检查专利状态
        if (patent.status === 'processing') {
          errors.push({
            patentId,
            message: '专利正在处理中'
          });
          continue;
        }

        // 生成任务ID
        const taskId = uuidv4();

        // 创建任务记录
        await patentModel.createTask(req.user.id, patent.id, taskId);

        // 更新专利状态为处理中
        await patentModel.updateStatus(patent.id, 'processing');

        // 启动异步处理
        processPatentAsync(req.db, patent, taskId, settings);

        results.push({
          patentId: patent.id,
          taskId,
          message: '专利处理已开始'
        });
      } catch (error) {
        console.error(`处理专利 ${patentId} 错误:`, error);
        errors.push({
          patentId,
          message: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `批量处理已开始，成功提交: ${results.length}，失败: ${errors.length}`,
      data: {
        batchId,
        results,
        errors
      }
    });
  } catch (error) {
    console.error('批量处理专利错误:', error);
    res.status(500).json({
      success: false,
      message: '批量处理专利过程中发生错误',
      error: error.message
    });
  }
};

// 批量下载结果
exports.downloadBatchResults = async (req, res) => {
  try {
    const { patentIds } = req.body;

    if (!patentIds || !Array.isArray(patentIds) || patentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的专利ID列表'
      });
    }

    const patentModel = new Patent(req.db);
    const tempDir = path.join(__dirname, '../../uploads/temp', uuidv4());
    await mkdir(tempDir, { recursive: true });

    // 创建ZIP文件
    const JSZip = require('jszip');
    const zip = new JSZip();

    // 处理每个专利
    for (const patentId of patentIds) {
      try {
        // 检查专利是否存在
        const patent = await patentModel.findById(patentId, req.user.id);
        if (!patent || patent.status !== 'completed') {
          continue;
        }

        // 构建结果文件路径 - 统一使用uploads/patents/{专利ID}目录
        const resultsDir = path.join(__dirname, '../../uploads/patents', patent.id.toString());
        const resultsZipPath = path.join(resultsDir, 'results.zip');

        // 检查结果文件是否存在
        if (!fs.existsSync(resultsZipPath)) {
          continue;
        }

        // 读取结果文件
        const resultsData = await readFile(resultsZipPath);

        // 添加到ZIP文件
        zip.file(`${patent.title}_results.zip`, resultsData);
      } catch (error) {
        console.error(`添加专利 ${patentId} 结果到批量下载错误:`, error);
      }
    }

    // 生成ZIP文件
    const zipData = await zip.generateAsync({ type: 'nodebuffer' });

    // 设置响应头
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="batch_results.zip"`);

    // 发送文件
    res.send(zipData);

    // 清理临时目录
    try {
      await rimraf(tempDir);
    } catch (cleanupError) {
      console.error('清理临时目录错误:', cleanupError);
    }
  } catch (error) {
    console.error('批量下载结果错误:', error);
    res.status(500).json({
      success: false,
      message: '批量下载结果过程中发生错误',
      error: error.message
    });
  }
};

// 批量删除专利
exports.deleteBatchPatents = async (req, res) => {
  try {
    const { patentIds } = req.body;

    if (!patentIds || !Array.isArray(patentIds) || patentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的专利ID列表'
      });
    }

    const patentModel = new Patent(req.db);
    const results = [];
    const errors = [];

    // 处理每个专利
    for (const patentId of patentIds) {
      try {
        const success = await patentModel.delete(patentId, req.user.id);
        if (success) {
          results.push(patentId);
        } else {
          errors.push({
            patentId,
            message: '专利不存在或无权删除'
          });
        }
      } catch (error) {
        console.error(`删除专利 ${patentId} 错误:`, error);
        errors.push({
          patentId,
          message: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `批量删除完成，成功: ${results.length}，失败: ${errors.length}`,
      data: {
        deletedPatentIds: results,
        errors
      }
    });
  } catch (error) {
    console.error('批量删除专利错误:', error);
    res.status(500).json({
      success: false,
      message: '批量删除专利过程中发生错误',
      error: error.message
    });
  }
};

// 获取用户设置
exports.getSettings = async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      'SELECT * FROM settings WHERE user_id = ?',
      [req.user.id]
    );

    const settings = rows[0] || {
      server_url: 'http://localhost:8080',
      remote_mode: false,
      username: '',
      password: '',
      default_output_dir: '',
      mineru_server_url: 'http://172.19.1.81:8010',
      chemical_extraction_server_url: 'http://172.19.1.81:8011'
    };

    // 不返回密码
    delete settings.password;

    res.status(200).json({
      success: true,
      data: {
        settings
      }
    });
  } catch (error) {
    console.error('获取设置错误:', error);
    res.status(500).json({
      success: false,
      message: '获取设置过程中发生错误',
      error: error.message
    });
  }
};

// 更新用户设置
exports.updateSettings = async (req, res) => {
  try {
    const {
      serverUrl,
      remoteMode,
      username,
      password,
      defaultOutputDir,
      mineruServerUrl,
      chemicalExtractionServerUrl
    } = req.body;

    // 检查是否已有设置
    const [rows] = await req.db.execute(
      'SELECT * FROM settings WHERE user_id = ?',
      [req.user.id]
    );

    if (rows.length > 0) {
      // 更新现有设置
      const updateFields = [];
      const updateValues = [];

      if (serverUrl !== undefined) {
        updateFields.push('server_url = ?');
        updateValues.push(serverUrl);
      }

      if (remoteMode !== undefined) {
        updateFields.push('remote_mode = ?');
        updateValues.push(remoteMode ? 1 : 0);
      }

      if (username !== undefined) {
        updateFields.push('username = ?');
        updateValues.push(username);
      }

      if (password !== undefined && password !== '') {
        updateFields.push('password = ?');
        updateValues.push(password);
      }

      if (defaultOutputDir !== undefined) {
        updateFields.push('default_output_dir = ?');
        updateValues.push(defaultOutputDir);
      }

      if (mineruServerUrl !== undefined) {
        updateFields.push('mineru_server_url = ?');
        updateValues.push(mineruServerUrl);
      }

      if (chemicalExtractionServerUrl !== undefined) {
        updateFields.push('chemical_extraction_server_url = ?');
        updateValues.push(chemicalExtractionServerUrl);
      }

      if (updateFields.length > 0) {
        updateValues.push(req.user.id);
        await req.db.execute(
          `UPDATE settings SET ${updateFields.join(', ')} WHERE user_id = ?`,
          updateValues
        );
      }
    } else {
      // 创建新设置
      await req.db.execute(
        'INSERT INTO settings (user_id, server_url, remote_mode, username, password, default_output_dir, mineru_server_url, chemical_extraction_server_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          req.user.id,
          serverUrl || 'http://localhost:8080',
          remoteMode ? 1 : 0,
          username || '',
          password || '',
          defaultOutputDir || '',
          mineruServerUrl || 'http://172.19.1.81:8010',
          chemicalExtractionServerUrl || 'http://172.19.1.81:8011'
        ]
      );
    }

    res.status(200).json({
      success: true,
      message: '设置已更新'
    });
  } catch (error) {
    console.error('更新设置错误:', error);
    res.status(500).json({
      success: false,
      message: '更新设置过程中发生错误',
      error: error.message
    });
  }
};

// 测试与化学式提取服务器的连接
// 这个API不需要认证，可以在登录前使用
exports.testConnection = async (req, res) => {
  try {
    // 获取用户ID或从查询参数中获取URL
    const userId = req.user && req.user.id ? req.user.id : null;
    const urlFromQuery = req.query.url;

    console.log('测试化学式提取服务器连接，参数:', {
      userId,
      urlFromQuery
    });

    // 优先使用查询参数中的URL，其次使用用户配置，最后使用默认值
    let serverUrl = urlFromQuery || chemicalClient.DEFAULT_CHEMICAL_EXTRACTION_SERVER_URL;
    if (!urlFromQuery && userId) {
      serverUrl = await chemicalClient.getUserServerUrl(userId, 'chemical');
    }

    console.log(`使用服务器URL: ${serverUrl}`);

    // 测试连接
    try {
      // 确保URL不以斜杠结尾
      if (serverUrl.endsWith('/')) {
        serverUrl = serverUrl.slice(0, -1);
      }

      const isConnected = await chemicalClient.testConnection(serverUrl);

      if (isConnected) {
        res.status(200).json({
          success: true,
          message: '成功连接到化学式提取服务器',
          url: serverUrl
        });
      } else {
        console.log('返回失败响应');
        res.status(200).json({
          success: false,
          message: '无法连接到化学式提取服务器，请检查URL是否正确',
          url: serverUrl
        });
      }
    } catch (connectionError) {
      console.error('连接测试过程中发生错误:', connectionError);

      // 尝试不同的API端点
      try {
        console.log('尝试备用API端点...');
        // 尝试使用list_files API
        const axios = require('axios');
        const listFilesUrl = `${serverUrl}/api/list_files?dir_path=/`;
        console.log(`尝试访问: ${listFilesUrl}`);

        const response = await axios.get(listFilesUrl, { timeout: 5000 });
        if (response.status === 200) {
          res.status(200).json({
            success: true,
            message: '成功连接到化学式提取服务器（使用备用API）',
            url: serverUrl
          });
          return;
        }
      } catch (altError) {
        console.error('备用API测试失败:', altError.message);
      }

      res.status(200).json({
        success: false,
        message: `连接测试失败: ${connectionError.message}`,
        url: serverUrl
      });
    }
  } catch (error) {
    console.error('测试化学式提取服务器连接错误:', error);
    res.status(500).json({
      success: false,
      message: '测试连接过程中发生错误',
      error: error.message
    });
  }
};