const User = require('../models/user.model');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// 创建邮件发送器
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: process.env.MAIL_SECURE === 'true',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// 注册新用户
exports.register = async (req, res) => {
  try {
    const { username, email, password, fullName, verificationCode } = req.body;

    // 验证必填字段
    if (!username || !email || !password || !verificationCode) {
      return res.status(400).json({
        success: false,
        message: '请提供所有必填字段'
      });
    }

    const userModel = new User(req.db);

    // 验证验证码
    const isCodeValid = await userModel.verifyCode(email, verificationCode);
    if (!isCodeValid) {
      return res.status(400).json({
        success: false,
        message: '验证码无效或已过期'
      });
    }

    // 检查用户名是否已存在
    const existingUsername = await userModel.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: '用户名已被使用'
      });
    }

    // 检查邮箱是否已存在
    const existingEmail = await userModel.findByEmail(email);
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: '邮箱已被注册'
      });
    }

    // 创建新用户
    const newUser = await userModel.create({
      username,
      email,
      password,
      fullName
    });

    // 创建会话
    const session = await userModel.createSession(
      newUser.id,
      req.ip,
      req.headers['user-agent']
    );

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          fullName: newUser.fullName
        },
        token: session.token,
        expiresAt: session.expiresAt
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({
      success: false,
      message: '注册过程中发生错误',
      error: error.message
    });
  }
};

// 用户登录
exports.login = async (req, res) => {
  try {
    const { username, password, verificationCode } = req.body;

    // 验证必填字段
    if (!username || !password || !verificationCode) {
      return res.status(400).json({
        success: false,
        message: '请提供所有必填字段'
      });
    }

    const userModel = new User(req.db);

    // 查找用户
    const user = await userModel.findByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 验证验证码
    const isCodeValid = await userModel.verifyCode(user.email, verificationCode);
    if (!isCodeValid) {
      return res.status(400).json({
        success: false,
        message: '验证码无效或已过期'
      });
    }

    // 验证密码
    const isPasswordValid = await userModel.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 创建会话
    const session = await userModel.createSession(
      user.id,
      req.ip,
      req.headers['user-agent']
    );

    // 更新最后登录时间
    await req.db.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    res.status(200).json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          avatar: user.avatar,
          role: user.role
        },
        token: session.token,
        expiresAt: session.expiresAt
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '登录过程中发生错误',
      error: error.message
    });
  }
};

// 退出登录
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(400).json({
        success: false,
        message: '未提供令牌'
      });
    }

    const userModel = new User(req.db);
    await userModel.deleteSession(token);

    res.status(200).json({
      success: true,
      message: '已成功退出登录'
    });
  } catch (error) {
    console.error('退出登录错误:', error);
    res.status(500).json({
      success: false,
      message: '退出登录过程中发生错误',
      error: error.message
    });
  }
};

// 获取当前用户信息
exports.getCurrentUser = async (req, res) => {
  try {
    // 用户信息已在auth中间件中添加到req对象
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未授权'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息过程中发生错误',
      error: error.message
    });
  }
};

// 发送验证码
exports.sendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: '请提供邮箱地址'
      });
    }

    const userModel = new User(req.db);
    const code = await userModel.generateVerificationCode(email);

    // 发送验证码邮件
    await transporter.sendMail({
      from: `"专利化学式提取系统" <${process.env.MAIL_USER}>`,
      to: email,
      subject: '验证码 - 专利化学式提取系统',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">专利化学式提取系统</h2>
          <p>您好，</p>
          <p>您的验证码是：</p>
          <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>此验证码将在10分钟后过期。</p>
          <p>如果您没有请求此验证码，请忽略此邮件。</p>
          <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
            © ${new Date().getFullYear()} 专利化学式提取系统
          </p>
        </div>
      `
    });

    res.status(200).json({
      success: true,
      message: '验证码已发送到您的邮箱'
    });
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({
      success: false,
      message: '发送验证码过程中发生错误',
      error: error.message
    });
  }
};

// 验证令牌
exports.verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供令牌'
      });
    }

    const userModel = new User(req.db);
    const session = await userModel.verifySession(token);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: '令牌无效或已过期'
      });
    }

    res.status(200).json({
      success: true,
      message: '令牌有效',
      data: {
        user: {
          id: session.user_id,
          username: session.username,
          email: session.email,
          role: session.role
        },
        expiresAt: session.expires_at
      }
    });
  } catch (error) {
    console.error('验证令牌错误:', error);
    res.status(500).json({
      success: false,
      message: '验证令牌过程中发生错误',
      error: error.message
    });
  }
};
