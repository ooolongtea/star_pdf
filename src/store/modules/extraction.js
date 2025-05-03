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
    defaultOutputDir: '',
    mineruServerUrl: 'http://172.19.1.81:8010',
    chemicalExtractionServerUrl: 'http://172.19.1.81:8011'
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
        dispatch('pollTaskStatus', response.data.data.taskId, { count: 0, interval: 5000 });
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
  async pollTaskStatus({ commit, dispatch, state }, taskId, retryInfo = { count: 0, interval: 5000 }) {
    try {
      // 检查当前任务是否已经完成或失败，如果是则停止轮询
      if (state.currentTask && state.currentTask.task_id === taskId) {
        if (state.currentTask.status === 'completed' || state.currentTask.status === 'failed') {
          console.log(`任务 ${taskId} 已经${state.currentTask.status === 'completed' ? '完成' : '失败'}，停止轮询`);
          return; // 停止轮询
        }
      }

      const response = await axios.get(`/api/extraction/tasks/${taskId}`);

      if (response.data.success) {
        // 成功获取数据，重置重试信息
        retryInfo.count = 0;

        const task = response.data.data.task;
        commit('UPDATE_TASK', task);

        // 使用服务器推荐的轮询间隔（如果有）
        const recommendedInterval = response.data.data.recommendedPollInterval || 5;
        retryInfo.interval = recommendedInterval * 1000; // 转换为毫秒

        console.log(`使用轮询间隔: ${recommendedInterval}秒`);

        // 如果任务仍在进行中，继续轮询
        if (task.status === 'pending' || task.status === 'running') {
          setTimeout(() => {
            dispatch('pollTaskStatus', taskId, retryInfo);
          }, retryInfo.interval);
        } else if (task.status === 'completed') {
          dispatch('setNotification', {
            type: 'success',
            message: '专利处理已完成'
          }, { root: true });

          // 刷新专利列表
          dispatch('patents/fetchPatents', {}, { root: true });

          // 不再继续轮询
          console.log(`任务 ${taskId} 已完成，停止轮询`);
        } else if (task.status === 'failed') {
          dispatch('setError', `专利处理失败: ${task.error || '未知错误'}`, { root: true });

          // 不再继续轮询
          console.log(`任务 ${taskId} 已失败，停止轮询`);
        }
      } else {
        // 响应成功但数据不成功，停止轮询
        console.log(`任务 ${taskId} 响应异常，停止轮询`);
        dispatch('setError', response.data.message || '获取任务状态失败', { root: true });
      }
    } catch (error) {
      console.error('轮询任务状态错误:', error);

      // 检查是否是404错误（任务不存在）
      if (error.response && error.response.status === 404) {
        console.log(`任务 ${taskId} 不存在，停止轮询`);
        // 任务不存在，停止轮询
        dispatch('setNotification', {
          type: 'warning',
          message: '任务不存在或已被删除'
        }, { root: true });

        // 清除当前任务
        commit('SET_CURRENT_TASK', null);

        // 刷新专利列表
        dispatch('patents/fetchPatents', {}, { root: true });

        return; // 停止轮询
      }

      // 处理429错误（请求过多）- 实现指数退避
      if (error.response && error.response.status === 429) {
        console.log(`任务 ${taskId} 请求过多(429)，实施指数退避`);

        // 增加重试计数
        retryInfo.count++;

        // 指数退避算法：基础间隔 * 2^重试次数，最大不超过60秒
        // 例如：5s, 10s, 20s, 40s, 60s, 60s, ...
        retryInfo.interval = Math.min(retryInfo.interval * 2, 60000);

        console.log(`下次重试间隔: ${retryInfo.interval / 1000}秒`);

        setTimeout(() => {
          dispatch('pollTaskStatus', taskId, retryInfo);
        }, retryInfo.interval);

        return;
      }

      // 其他错误时继续轮询，但增加间隔，最多重试5次
      retryInfo.count = (retryInfo.count || 0) + 1;
      if (retryInfo.count <= 5) {
        setTimeout(() => {
          dispatch('pollTaskStatus', taskId, retryInfo);
        }, 5000); // 出错后5秒再试
      } else {
        console.log(`任务 ${taskId} 轮询失败超过5次，停止轮询`);
        dispatch('setError', '获取任务状态失败，请刷新页面重试', { root: true });
      }
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
