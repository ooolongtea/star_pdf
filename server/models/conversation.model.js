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
}

module.exports = Conversation;
