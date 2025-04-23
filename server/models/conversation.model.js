class Conversation {
  constructor(db) {
    this.db = db;
  }

  // 创建新对话
  async create(userId, title, modelName) {
    try {
      const [result] = await this.db.execute(
        'INSERT INTO conversations (user_id, title, model_name) VALUES (?, ?, ?)',
        [userId, title || '新对话', modelName]
      );

      return {
        id: result.insertId,
        user_id: userId,
        title,
        model_name: modelName,
        created_at: new Date()
      };
    } catch (error) {
      throw error;
    }
  }

  // 获取用户的所有对话
  async getByUserId(userId) {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC',
        [userId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // 获取特定对话
  async getById(id, userId) {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // 更新对话标题
  async updateTitle(id, userId, title) {
    try {
      const [result] = await this.db.execute(
        'UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?',
        [title, id, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // 删除对话
  async delete(id, userId) {
    try {
      const [result] = await this.db.execute(
        'DELETE FROM conversations WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // 更新对话的最后修改时间
  async updateTimestamp(id) {
    try {
      await this.db.execute(
        'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
    } catch (error) {
      throw error;
    }
  }

  // 更新对话模型
  async updateModel(id, userId, modelName) {
    try {
      console.log('开始更新对话模型:', { id, userId, modelName });

      // 首先检查对话是否存在
      const [rows] = await this.db.execute(
        'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      console.log('检查对话存在结果:', rows.length > 0 ? '存在' : '不存在');

      if (rows.length === 0) {
        console.log('对话不存在或无权访问');
        return false;
      }

      // 更新模型
      const [result] = await this.db.execute(
        'UPDATE conversations SET model_name = ? WHERE id = ? AND user_id = ?',
        [modelName, id, userId]
      );

      const success = result.affectedRows > 0;
      console.log('更新模型结果:', success ? '成功' : '失败', '影响行数:', result.affectedRows);

      return success;
    } catch (error) {
      console.error('更新对话模型错误:', error);
      throw error;
    }
  }
}

module.exports = Conversation;
