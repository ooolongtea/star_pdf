class Message {
  constructor(db) {
    this.db = db;
  }

  // 创建新消息
  async create(conversationId, role, content) {
    try {
      const [result] = await this.db.execute(
        'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
        [conversationId, role, content]
      );

      return { 
        id: result.insertId, 
        conversation_id: conversationId, 
        role, 
        content,
        created_at: new Date()
      };
    } catch (error) {
      throw error;
    }
  }

  // 获取对话的所有消息
  async getByConversationId(conversationId) {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
        [conversationId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // 获取特定消息
  async getById(id) {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM messages WHERE id = ?',
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // 删除对话的所有消息
  async deleteByConversationId(conversationId) {
    try {
      const [result] = await this.db.execute(
        'DELETE FROM messages WHERE conversation_id = ?',
        [conversationId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Message;
