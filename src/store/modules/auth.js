import axios from '../../plugins/axios';

// 初始状态
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user')) || null,
  tokenExpiry: localStorage.getItem('tokenExpiry') || null,
  isVerifying: false // 添加一个状态来跟踪令牌验证过程
};

// 获取器
const getters = {
  isAuthenticated: state => !!state.token && !!state.user,
  getUser: state => state.user,
  getToken: state => state.token,
  getTokenExpiry: state => state.tokenExpiry,
  isVerifyingToken: state => state.isVerifying
};

// 修改器
const mutations = {
  SET_TOKEN(state, { token, expiry }) {
    state.token = token;
    state.tokenExpiry = expiry;
    localStorage.setItem('token', token);
    localStorage.setItem('tokenExpiry', expiry);
  },
  SET_USER(state, user) {
    state.user = user;
    // 将用户信息存储到本地存储
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  },
  SET_VERIFYING(state, isVerifying) {
    state.isVerifying = isVerifying;
  },
  CLEAR_AUTH(state) {
    state.token = null;
    state.user = null;
    state.tokenExpiry = null;
    localStorage.removeItem('token');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('user');
  }
};

// 动作
const actions = {
  // 注册
  async register({ commit, dispatch }, userData) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.post('/api/auth/register', userData);

      if (response.data.success) {
        const { token, expiresAt } = response.data.data;
        commit('SET_TOKEN', { token, expiry: expiresAt });
        commit('SET_USER', response.data.data.user);
        dispatch('setNotification', {
          type: 'success',
          message: '注册成功！欢迎使用专利化学式提取系统。'
        }, { root: true });
      }

      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '注册失败，请稍后重试';
      dispatch('setError', message, { root: true });
      throw error;
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  },

  // 登录
  async login({ commit, dispatch }, credentials) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.post('/api/auth/login', credentials);

      if (response.data.success) {
        const { token, expiresAt } = response.data.data;
        commit('SET_TOKEN', { token, expiry: expiresAt });
        commit('SET_USER', response.data.data.user);
        dispatch('setNotification', {
          type: 'success',
          message: '登录成功！'
        }, { root: true });
      }

      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '登录失败，请检查您的用户名和密码';
      dispatch('setError', message, { root: true });
      throw error;
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  },

  // 退出登录
  async logout({ commit, dispatch, state }) {
    try {
      dispatch('setLoading', true, { root: true });

      if (state.token) {
        await axios.post('/api/auth/logout');
      }

      commit('CLEAR_AUTH');
      dispatch('setNotification', {
        type: 'success',
        message: '您已成功退出登录'
      }, { root: true });
    } catch (error) {
      console.error('退出登录错误:', error);
      // 即使API调用失败，也清除本地认证状态
      commit('CLEAR_AUTH');
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  },

  // 验证令牌
  async verifyToken({ commit, dispatch, state }, token) {
    // 如果已经在验证中，则返回
    if (state.isVerifying) {
      console.log('令牌验证已在进行中，跳过重复验证');
      return;
    }

    try {
      // 设置验证状态
      commit('SET_VERIFYING', true);
      dispatch('setLoading', true, { root: true });
      console.log('开始验证令牌...');

      // 如果没有令牌，则直接返回失败
      if (!token) {
        console.log('没有令牌可验证');
        commit('CLEAR_AUTH');
        return false;
      }

      // 设置请求头
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const response = await axios.get('/api/auth/verify-token');

      if (response.data.success) {
        console.log('令牌验证成功，设置用户信息');
        commit('SET_USER', response.data.data.user);
        commit('SET_TOKEN', {
          token,
          expiry: response.data.data.expiresAt
        });
        return true;
      } else {
        // 令牌无效，清除认证状态
        console.log('令牌验证失败，清除认证状态');
        commit('CLEAR_AUTH');
        return false;
      }
    } catch (error) {
      console.error('验证令牌错误:', error);
      // 出错时清除认证状态
      commit('CLEAR_AUTH');
      return false;
    } finally {
      commit('SET_VERIFYING', false);
      dispatch('setLoading', false, { root: true });
    }
  },

  // 发送验证码
  async sendVerificationCode({ dispatch }, email) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.post('/api/auth/verification-code', { email });

      if (response.data.success) {
        dispatch('setNotification', {
          type: 'success',
          message: '验证码已发送到您的邮箱'
        }, { root: true });
      }

      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '发送验证码失败，请稍后重试';
      dispatch('setError', message, { root: true });
      throw error;
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  },

  // 获取当前用户信息
  async getCurrentUser({ commit, dispatch }) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.get('/api/auth/me');

      if (response.data.success) {
        commit('SET_USER', response.data.data.user);
      }

      return response.data;
    } catch (error) {
      console.error('获取用户信息错误:', error);
      if (error.response?.status === 401) {
        // 未授权，清除认证状态
        commit('CLEAR_AUTH');
      }
      throw error;
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  },

  // 更新用户信息
  async updateProfile({ commit, dispatch, state }, userData) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.put('/api/users/profile', userData);

      if (response.data.success) {
        // 更新本地用户信息
        const currentUser = { ...state.user };
        const updatedUser = { ...currentUser, ...userData };
        commit('SET_USER', updatedUser);

        dispatch('setNotification', {
          type: 'success',
          message: '用户信息已更新'
        }, { root: true });
      }

      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '更新用户信息失败，请稍后重试';
      dispatch('setError', message, { root: true });
      throw error;
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  },

  // 更新密码
  async updatePassword({ dispatch }, passwordData) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.put('/api/users/password', passwordData);

      if (response.data.success) {
        dispatch('setNotification', {
          type: 'success',
          message: '密码已成功更新'
        }, { root: true });
      }

      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '更新密码失败，请稍后重试';
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
