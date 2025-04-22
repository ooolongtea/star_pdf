import axios from '../../plugins/axios';

// 初始状态
const state = {
  token: localStorage.getItem('token') || null,
  user: null,
  tokenExpiry: localStorage.getItem('tokenExpiry') || null
};

// 获取器
const getters = {
  isAuthenticated: state => !!state.token && !!state.user,
  getUser: state => state.user,
  getToken: state => state.token,
  getTokenExpiry: state => state.tokenExpiry
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
  },
  CLEAR_AUTH(state) {
    state.token = null;
    state.user = null;
    state.tokenExpiry = null;
    localStorage.removeItem('token');
    localStorage.removeItem('tokenExpiry');
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
      const message = error.response?.data?.message || '登录失败，请检查您的凭据';
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
  async verifyToken({ commit, dispatch }, token) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.get('/api/auth/verify-token');
      
      if (response.data.success) {
        commit('SET_USER', response.data.data.user);
        commit('SET_TOKEN', { 
          token, 
          expiry: response.data.data.expiresAt 
        });
      } else {
        // 令牌无效，清除认证状态
        commit('CLEAR_AUTH');
      }
      
      return response.data.success;
    } catch (error) {
      console.error('验证令牌错误:', error);
      // 出错时清除认证状态
      commit('CLEAR_AUTH');
      return false;
    } finally {
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
  }
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
};
