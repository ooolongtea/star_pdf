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
    const { username, password } = req.body;

    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供用户名/邮箱和密码'
      });
    }

    const userModel = new User(req.db);
    let user;

    // 判断输入的是用户名还是邮箱
    const isEmail = username.includes('@');

    // 根据输入类型查找用户
    if (isEmail) {
      // 使用邮箱查找
      user = await userModel.findByEmail(username);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '邮箱或密码错误'
        });
      }
    } else {
      // 使用用户名查找
      user = await userModel.findByUsername(username);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }
    }

    // 验证密码
    const isPasswordValid = await userModel.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: isEmail ? '邮箱或密码错误' : '用户名或密码错误'
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
    try {
      await transporter.sendMail({
        from: `"专利化学式提取系统" <${process.env.MAIL_USER}>`,
        to: email,
        subject: '验证码 - 专利化学式提取系统',
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border-radius: 8px; background-color: #ffffff; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4A90E2; margin: 0; font-size: 28px; font-weight: 600;">专利化学式提取系统</h1>
              <div style="width: 100px; height: 4px; background-color: #4A90E2; margin: 15px auto;"></div>
            </div>

            <div style="color: #333333; font-size: 16px; line-height: 1.6;">
              <p style="margin-bottom: 20px;">尊敬的用户，您好！</p>
              <p style="margin-bottom: 20px;">您正在进行账号注册或登录操作，请使用以下验证码完成验证：</p>

              <div style="background-color: #f8f9fa; border-left: 4px solid #4A90E2; padding: 15px 20px; margin: 25px 0; text-align: center;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4A90E2;">${code}</span>
              </div>

              <p style="margin-bottom: 10px; color: #666;">验证码有效期为<span style="color: #e74c3c; font-weight: bold;">10分钟</span>，请勿将验证码泄露给他人。</p>
              <p style="margin-bottom: 20px; color: #666;">如果您没有请求此验证码，请忽略此邮件。</p>
            </div>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 13px;">
              <p>此邮件由系统自动发送，请勿直接回复</p>
              <p style="margin-top: 10px;">© ${new Date().getFullYear()} 专利化学式提取系统 版权所有</p>
            </div>
          </div>
        `
      });
    } catch (emailError) {
      console.error('邮件发送失败:', emailError);
      return res.status(500).json({
        success: false,
        message: '验证码邮件发送失败，请稍后重试'
      });
    }

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
