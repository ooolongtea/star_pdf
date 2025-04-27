import { createStore } from 'vuex';
import auth from './modules/auth';
import extraction from './modules/extraction';
import patents from './modules/patents';
import chat from './modules/chat';

// 创建Vuex存储
export default createStore({
  modules: {
    auth,
    extraction,
    patents,
    chat
  },
  // 根状态
  state: {
    loading: false,
    error: null,
    notification: null
  },
  // 获取器
  getters: {
    isLoading: state => state.loading,
    getError: state => state.error,
    getNotification: state => state.notification
  },
  // 修改器
  mutations: {
    SET_LOADING(state, loading) {
      state.loading = loading;
    },
    SET_ERROR(state, error) {
      state.error = error;
    },
    CLEAR_ERROR(state) {
      state.error = null;
    },
    SET_NOTIFICATION(state, notification) {
      state.notification = notification;
    },
    CLEAR_NOTIFICATION(state) {
      state.notification = null;
    }
  },
  // 动作
  actions: {
    setLoading({ commit }, loading) {
      commit('SET_LOADING', loading);
    },
    setError({ commit }, error) {
      // 如果error是字符串，并且有isHTML标志，则将其转换为对象
      if (typeof error === 'string' && arguments[2] && arguments[2].isHTML) {
        commit('SET_ERROR', { message: error, isHTML: true });
      } else {
        commit('SET_ERROR', error);
      }

      // 5秒后自动清除错误
      setTimeout(() => {
        commit('CLEAR_ERROR');
      }, 5000);
    },
    clearError({ commit }) {
      commit('CLEAR_ERROR');
    },
    setNotification({ commit }, notification) {
      commit('SET_NOTIFICATION', notification);
      // 5秒后自动清除通知
      setTimeout(() => {
        commit('CLEAR_NOTIFICATION');
      }, 5000);
    },
    clearNotification({ commit }) {
      commit('CLEAR_NOTIFICATION');
    }
  }
});
