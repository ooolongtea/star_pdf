import axios from '../../plugins/axios';

// 初始状态
const state = {
  currentTask: null,
  tasks: [],
  tasksPagination: {
    total: 0,
    page: 1,
    limit: 10,
    pages: 0
  },
  settings: {
    serverUrl: 'http://localhost:8080',
    remoteMode: false,
    username: '',
    defaultOutputDir: ''
  }
};

// 获取器
const getters = {
  getCurrentTask: state => state.currentTask,
  getTasks: state => state.tasks,
  getTasksPagination: state => state.tasksPagination,
  getSettings: state => state.settings
};

// 修改器
const mutations = {
  SET_CURRENT_TASK(state, task) {
    state.currentTask = task;
  },
  SET_TASKS(state, { tasks, pagination }) {
    state.tasks = tasks;
    state.tasksPagination = pagination;
  },
  UPDATE_TASK(state, updatedTask) {
    const index = state.tasks.findIndex(task => task.task_id === updatedTask.task_id);
    if (index !== -1) {
      state.tasks.splice(index, 1, updatedTask);
    }
    if (state.currentTask && state.currentTask.task_id === updatedTask.task_id) {
      state.currentTask = updatedTask;
    }
  },
  SET_SETTINGS(state, settings) {
    state.settings = settings;
  }
};

// 动作
const actions = {
  // 上传专利文件
  async uploadPatent({ dispatch }, formData) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.post('/api/extraction/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        dispatch('setNotification', {
          type: 'success',
          message: '专利文件上传成功'
        }, { root: true });

        // 刷新专利列表
        dispatch('patents/fetchPatents', {}, { root: true });
      }

      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '上传专利文件失败，请稍后重试';
      dispatch('setError', message, { root: true });
      throw error;
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  },

  // 处理专利
  async processPatent({ commit, dispatch }, patentId) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.post(`/api/extraction/patents/${patentId}/process`);

      if (response.data.success) {
        commit('SET_CURRENT_TASK', {
          task_id: response.data.data.taskId,
          patent_id: patentId,
          status: 'pending',
          progress: 0,
          message: '任务已创建，等待处理'
        });

        dispatch('setNotification', {
          type: 'success',
          message: '专利处理已开始'
        }, { root: true });

        // 开始轮询任务状态
        dispatch('pollTaskStatus', response.data.data.taskId);
      }

      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '处理专利失败，请稍后重试';
      dispatch('setError', message, { root: true });
      throw error;
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  },

  // 轮询任务状态
  async pollTaskStatus({ commit, dispatch }, taskId) {
    try {
      const response = await axios.get(`/api/extraction/tasks/${taskId}`);

      if (response.data.success) {
        const task = response.data.data.task;
        commit('UPDATE_TASK', task);

        // 如果任务仍在进行中，继续轮询
        if (task.status === 'pending' || task.status === 'running') {
          setTimeout(() => {
            dispatch('pollTaskStatus', taskId);
          }, 2000); // 每2秒轮询一次
        } else if (task.status === 'completed') {
          dispatch('setNotification', {
            type: 'success',
            message: '专利处理已完成'
          }, { root: true });

          // 刷新专利列表
          dispatch('patents/fetchPatents', {}, { root: true });
        } else if (task.status === 'failed') {
          dispatch('setError', `专利处理失败: ${task.error || '未知错误'}`, { root: true });
        }
      }
    } catch (error) {
      console.error('轮询任务状态错误:', error);
      // 出错时继续轮询，但增加间隔
      setTimeout(() => {
        dispatch('pollTaskStatus', taskId);
      }, 5000); // 出错后5秒再试
    }
  },

  // 获取任务列表
  async fetchTasks({ commit, dispatch }, { page = 1, limit = 10, status = null } = {}) {
    try {
      dispatch('setLoading', true, { root: true });

      let url = `/api/extraction/tasks?page=${page}&limit=${limit}`;
      if (status) {
        url += `&status=${status}`;
      }

      const response = await axios.get(url);

      if (response.data.success) {
        commit('SET_TASKS', {
          tasks: response.data.data.tasks,
          pagination: response.data.data.pagination
        });
      }

      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '获取任务列表失败，请稍后重试';
      dispatch('setError', message, { root: true });
      throw error;
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  },

  // 获取任务详情
  async fetchTaskDetails({ commit, dispatch }, taskId) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.get(`/api/extraction/tasks/${taskId}`);

      if (response.data.success) {
        commit('SET_CURRENT_TASK', response.data.data.task);
      }

      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '获取任务详情失败，请稍后重试';
      dispatch('setError', message, { root: true });
      throw error;
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  },

  // 获取用户设置
  async fetchSettings({ commit, dispatch }) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.get('/api/extraction/settings');

      if (response.data.success) {
        commit('SET_SETTINGS', response.data.data.settings);
      }

      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '获取设置失败，请稍后重试';
      dispatch('setError', message, { root: true });
      throw error;
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  },

  // 更新用户设置
  async updateSettings({ commit, dispatch }, settings) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.put('/api/extraction/settings', settings);

      if (response.data.success) {
        commit('SET_SETTINGS', settings);
        dispatch('setNotification', {
          type: 'success',
          message: '设置已更新'
        }, { root: true });
      }

      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '更新设置失败，请稍后重试';
      dispatch('setError', message, { root: true });
      throw error;
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  }
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
};
