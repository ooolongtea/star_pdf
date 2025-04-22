const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class User {
  constructor(db) {
    this.db = db;
  }

  // 创建新用户
  async create(userData) {
    try {
      // 加密密码
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      const [result] = await this.db.execute(
        'INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)',
        [userData.username, userData.email, hashedPassword, userData.fullName || null]
      );

      return { id: result.insertId, ...userData, password: undefined };
    } catch (error) {
      throw error;
    }
  }

  // 通过ID查找用户
  async findById(id) {
    try {
      const [rows] = await this.db.execute(
        'SELECT id, username, email, full_name, avatar, role, created_at, updated_at FROM users WHERE id = ?',
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // 通过用户名查找用户
  async findByUsername(username) {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // 通过邮箱查找用户
  async findByEmail(email) {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // 验证用户密码
  async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // 创建会话
  async createSession(userId, ipAddress, userAgent) {
    try {
      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7天后过期

      await this.db.execute(
        'INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
        [userId, token, ipAddress, userAgent, expiresAt]
      );

      return { token, expiresAt };
    } catch (error) {
      throw error;
    }
  }

  // 验证会话
  async verifySession(token) {
    try {
      const [rows] = await this.db.execute(
        'SELECT s.*, u.id as user_id, u.username, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > NOW()',
        [token]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // 删除会话
  async deleteSession(token) {
    try {
      await this.db.execute('DELETE FROM sessions WHERE token = ?', [token]);
      return true;
    } catch (error) {
      throw error;
    }
  }

  // 更新用户信息
  async update(id, userData) {
    try {
      const fields = [];
      const values = [];

      if (userData.fullName) {
        fields.push('full_name = ?');
        values.push(userData.fullName);
      }

      if (userData.avatar) {
        fields.push('avatar = ?');
        values.push(userData.avatar);
      }

      if (userData.password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password, salt);
        fields.push('password = ?');
        values.push(hashedPassword);
      }

      if (fields.length === 0) {
        return null;
      }

      values.push(id);

      const [result] = await this.db.execute(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // 生成验证码
  async generateVerificationCode(email) {
    try {
      // 生成6位随机数字验证码
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 设置过期时间为10分钟后
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      // 删除该邮箱之前的验证码
      await this.db.execute('DELETE FROM verification_codes WHERE email = ?', [email]);

      // 插入新验证码
      await this.db.execute(
        'INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)',
        [email, code, expiresAt]
      );

      return code;
    } catch (error) {
      throw error;
    }
  }

  // 验证验证码
  async verifyCode(email, code) {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND expires_at > NOW()',
        [email, code]
      );

      if (rows.length > 0) {
        // 验证成功后删除验证码
        await this.db.execute('DELETE FROM verification_codes WHERE email = ?', [email]);
        return true;
      }

      return false;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;
