const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class Patent {
  constructor(db) {
    this.db = db;
  }

  // 创建新专利记录
  async create(patentData) {
    try {
      const [result] = await this.db.execute(
        'INSERT INTO patents (user_id, title, patent_number, description, file_path, file_size, file_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          patentData.userId,
          patentData.title,
          patentData.patentNumber || null,
          patentData.description || null,
          patentData.filePath,
          patentData.fileSize,
          patentData.fileType,
          patentData.status || 'pending'
        ]
      );

      return { id: result.insertId, ...patentData };
    } catch (error) {
      throw error;
    }
  }

  // 通过ID查找专利
  async findById(id, userId = null) {
    try {
      let query = 'SELECT * FROM patents WHERE id = ?';
      const params = [id];

      // 如果提供了userId，则只返回该用户的专利
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }

      const [rows] = await this.db.execute(query, params);
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // 获取用户的所有专利
  async findByUserId(userId, page = 1, limit = 10, status = null) {
    try {
      let query = 'SELECT * FROM patents WHERE user_id = ?';
      const params = [userId];

      // 如果提供了状态过滤
      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      // 添加排序和分页
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, (page - 1) * limit);

      const [rows] = await this.db.execute(query, params);

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM patents WHERE user_id = ?';
      const countParams = [userId];

      if (status) {
        countQuery += ' AND status = ?';
        countParams.push(status);
      }

      const [countResult] = await this.db.execute(countQuery, countParams);
      const total = countResult[0].total;

      return {
        patents: rows,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // 更新专利状态
  async updateStatus(id, status, userId = null) {
    try {
      let query = 'UPDATE patents SET status = ? WHERE id = ?';
      const params = [status, id];

      // 如果提供了userId，则只更新该用户的专利
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }

      const [result] = await this.db.execute(query, params);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // 删除专利
  async delete(id, userId = null) {
    try {
      // 首先获取专利信息，以便删除文件
      const patent = await this.findById(id, userId);
      if (!patent) {
        return false;
      }

      // 删除关联的分子和反应
      await this.db.execute('DELETE FROM molecules WHERE patent_id = ?', [id]);
      await this.db.execute('DELETE FROM reactions WHERE patent_id = ?', [id]);
      await this.db.execute('DELETE FROM tasks WHERE patent_id = ?', [id]);

      // 删除专利记录
      let query = 'DELETE FROM patents WHERE id = ?';
      const params = [id];

      // 如果提供了userId，则只删除该用户的专利
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }

      const [result] = await this.db.execute(query, params);

      // 如果数据库记录删除成功，尝试删除文件
      if (result.affectedRows > 0 && patent.file_path) {
        try {
          // 检查文件是否存在
          if (fs.existsSync(patent.file_path)) {
            fs.unlinkSync(patent.file_path);
          }
        } catch (fileError) {
          console.error('删除文件错误:', fileError);
          // 即使文件删除失败，我们仍然认为专利删除成功
        }
      }

      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // 保存分子数据
  async saveMolecules(patentId, molecules) {
    try {
      if (!molecules || molecules.length === 0) {
        return [];
      }

      // 准备批量插入
      const values = molecules.map(mol => [
        patentId,
        mol.image_id,
        mol.compound_smiles || null,
        mol.compound_name || null,
        mol.coref || null,
        mol.inchi || null,
        mol.inchi_key || null,
        mol.confidence || null,
        mol.page_number || null,
        mol.image_path || null,
        mol.visualization_path || null
      ]);

      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const flatValues = values.flat();

      const [result] = await this.db.execute(
        `INSERT INTO molecules (patent_id, image_id, compound_smiles, compound_name, coref, inchi, inchi_key, confidence, page_number, image_path, visualization_path) VALUES ${placeholders}`,
        flatValues
      );

      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  }

  // 保存反应数据
  async saveReactions(patentId, reactions) {
    try {
      if (!reactions || reactions.length === 0) {
        return [];
      }

      // 准备批量插入
      const values = reactions.map(rxn => [
        patentId,
        rxn.image_id,
        rxn.reactants_smiles || null,
        rxn.product_smiles || null,
        rxn.product_coref || null,
        rxn.conditions || null,
        rxn.image_path || null
      ]);

      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const flatValues = values.flat();

      const [result] = await this.db.execute(
        `INSERT INTO reactions (patent_id, image_id, reactants_smiles, product_smiles, product_coref, conditions, image_path) VALUES ${placeholders}`,
        flatValues
      );

      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  }

  // 获取专利的所有分子
  async getMolecules(patentId, page = 1, limit = 50) {
    try {
      const query = 'SELECT * FROM molecules WHERE patent_id = ? ORDER BY id LIMIT ? OFFSET ?';
      const [rows] = await this.db.execute(query, [patentId, limit, (page - 1) * limit]);

      // 获取总数
      const [countResult] = await this.db.execute(
        'SELECT COUNT(*) as total FROM molecules WHERE patent_id = ?',
        [patentId]
      );
      const total = countResult[0].total;

      return {
        molecules: rows,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // 获取专利的所有反应
  async getReactions(patentId, page = 1, limit = 50) {
    try {
      const query = 'SELECT * FROM reactions WHERE patent_id = ? ORDER BY id LIMIT ? OFFSET ?';
      const [rows] = await this.db.execute(query, [patentId, limit, (page - 1) * limit]);

      // 获取总数
      const [countResult] = await this.db.execute(
        'SELECT COUNT(*) as total FROM reactions WHERE patent_id = ?',
        [patentId]
      );
      const total = countResult[0].total;

      return {
        reactions: rows,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // 创建处理任务
  async createTask(userId, patentId, taskId) {
    try {
      const [result] = await this.db.execute(
        'INSERT INTO tasks (user_id, patent_id, task_id, status) VALUES (?, ?, ?, ?)',
        [userId, patentId, taskId, 'pending']
      );

      return { id: result.insertId, userId, patentId, taskId, status: 'pending' };
    } catch (error) {
      throw error;
    }
  }

  // 更新任务状态
  async updateTask(taskId, updateData) {
    try {
      const fields = [];
      const values = [];

      if (updateData.status) {
        fields.push('status = ?');
        values.push(updateData.status);
      }

      if (updateData.progress !== undefined) {
        fields.push('progress = ?');
        values.push(updateData.progress);
      }

      if (updateData.message) {
        fields.push('message = ?');
        values.push(updateData.message);
      }

      if (updateData.error) {
        fields.push('error = ?');
        values.push(updateData.error);
      }

      if (updateData.status === 'completed' || updateData.status === 'failed') {
        fields.push('end_time = NOW()');
      }

      if (fields.length === 0) {
        return false;
      }

      values.push(taskId);

      const [result] = await this.db.execute(
        `UPDATE tasks SET ${fields.join(', ')} WHERE task_id = ?`,
        values
      );

      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // 获取任务状态
  async getTask(taskId) {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM tasks WHERE task_id = ?',
        [taskId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // 获取用户的所有任务
  async getUserTasks(userId, page = 1, limit = 10, status = null) {
    try {
      let query = 'SELECT t.*, p.title as patent_title FROM tasks t JOIN patents p ON t.patent_id = p.id WHERE t.user_id = ?';
      const params = [userId];

      // 如果提供了状态过滤
      if (status) {
        query += ' AND t.status = ?';
        params.push(status);
      }

      // 添加排序和分页
      query += ' ORDER BY t.start_time DESC LIMIT ? OFFSET ?';
      params.push(limit, (page - 1) * limit);

      const [rows] = await this.db.execute(query, params);

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM tasks WHERE user_id = ?';
      const countParams = [userId];

      if (status) {
        countQuery += ' AND status = ?';
        countParams.push(status);
      }

      const [countResult] = await this.db.execute(countQuery, countParams);
      const total = countResult[0].total;

      return {
        tasks: rows,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Patent;
