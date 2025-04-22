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
    // 只允许PDF文件
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传PDF文件'), false);
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

      const { title, patentNumber, description } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          message: '请提供专利标题'
        });
      }

      const patentModel = new Patent(req.db);
      const newPatent = await patentModel.create({
        userId: req.user.id,
        title,
        patentNumber: patentNumber || null,
        description: description || null,
        filePath: req.file.path,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        status: 'pending'
      });

      res.status(201).json({
        success: true,
        message: '专利文件上传成功',
        data: {
          patent: {
            id: newPatent.id,
            title: newPatent.title,
            patentNumber: newPatent.patentNumber,
            description: newPatent.description,
            fileSize: newPatent.fileSize,
            status: newPatent.status,
            createdAt: new Date()
          }
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
      server_url: 'http://localhost:8080',
      remote_mode: false,
      username: 'user',
      password: 'password'
    };

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
    formData.append('patent_file', fs.createReadStream(tempPatentPath));
    
    // 发送到远程API
    const response = await axios.post(
      `${settings.server_url}/api/process_patent`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Basic ${Buffer.from(`${settings.username}:${settings.password}`).toString('base64')}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    // 检查响应
    if (!response.data.success) {
      throw new Error(response.data.message || '处理失败');
    }

    // 更新任务进度
    await patentModel.updateTask(taskId, {
      progress: 50,
      message: '正在下载处理结果'
    });

    // 下载结果
    const resultsPath = response.data.download_path || response.data.results_path;
    if (!resultsPath) {
      throw new Error('未找到结果路径');
    }

    const resultsResponse = await axios.get(
      `${settings.server_url}/api/download_file?file_path=${encodeURIComponent(resultsPath)}`,
      {
        responseType: 'arraybuffer',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${settings.username}:${settings.password}`).toString('base64')}`
        }
      }
    );

    // 保存结果
    const resultsDir = path.join(__dirname, '../../uploads/results', patent.id.toString());
    await mkdir(resultsDir, { recursive: true });
    
    const resultsZipPath = path.join(resultsDir, 'results.zip');
    await writeFile(resultsZipPath, resultsResponse.data);

    // 解压结果
    const extract = require('extract-zip');
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
                visualization_path: data.image_path.replace('/image/', '/image_visualizations/') + '_visualization.png'
              });
            });
          }
        }
      }
    }

    // 读取反应数据
    const rxnDir = path.join(resultsDir, 'rxn');
    if (fs.existsSync(rxnDir)) {
      const files = fs.readdirSync(rxnDir);
      for (const file of files) {
        if (file.endsWith('_rxnscribe_results.json')) {
          const data = JSON.parse(fs.readFileSync(path.join(rxnDir, file), 'utf8'));
          if (data.rxnscribe_data && data.rxnscribe_data.length > 0) {
            data.rxnscribe_data.forEach(rxn => {
              reactions.push({
                image_id: file.replace('_rxnscribe_results.json', ''),
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
      message: `处理完成，发现${molecules.length}个分子和${reactions.length}个反应`
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

    res.status(200).json({
      success: true,
      data: {
        task
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
      default_output_dir: ''
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
    const { serverUrl, remoteMode, username, password, defaultOutputDir } = req.body;

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
        'INSERT INTO settings (user_id, server_url, remote_mode, username, password, default_output_dir) VALUES (?, ?, ?, ?, ?, ?)',
        [
          req.user.id,
          serverUrl || 'http://localhost:8080',
          remoteMode ? 1 : 0,
          username || '',
          password || '',
          defaultOutputDir || ''
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
