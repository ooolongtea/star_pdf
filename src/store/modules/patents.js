import axios from '../../plugins/axios';

// 初始状态
const state = {
  patents: [],
  currentPatent: null,
  molecules: [],
  reactions: [],
  pagination: {
    total: 0,
    page: 1,
    limit: 10,
    pages: 0
  },
  moleculesTotal: 0,
  reactionsTotal: 0
};

// 获取器
const getters = {
  getPatents: state => state.patents,
  getCurrentPatent: state => state.currentPatent,
  getMolecules: state => state.molecules,
  getReactions: state => state.reactions,
  getPagination: state => state.pagination,
  getMoleculesTotal: state => state.moleculesTotal,
  getReactionsTotal: state => state.reactionsTotal
};

// 修改器
const mutations = {
  SET_PATENTS(state, { patents, pagination }) {
    state.patents = patents;
    state.pagination = pagination;
  },
  SET_CURRENT_PATENT(state, patent) {
    state.currentPatent = patent;
  },
  SET_MOLECULES(state, molecules) {
    state.molecules = molecules;
  },
  SET_REACTIONS(state, reactions) {
    state.reactions = reactions;
  },
  SET_MOLECULES_TOTAL(state, total) {
    state.moleculesTotal = total;
  },
  SET_REACTIONS_TOTAL(state, total) {
    state.reactionsTotal = total;
  },
  UPDATE_PATENT_STATUS(state, { id, status }) {
    const index = state.patents.findIndex(patent => patent.id === id);
    if (index !== -1) {
      state.patents[index].status = status;
    }
    if (state.currentPatent && state.currentPatent.id === id) {
      state.currentPatent.status = status;
    }
  },
  REMOVE_PATENT(state, id) {
    state.patents = state.patents.filter(patent => patent.id !== id);
    if (state.currentPatent && state.currentPatent.id === id) {
      state.currentPatent = null;
    }
  }
};

// 动作
const actions = {
  // 获取专利列表
  async fetchPatents({ commit, dispatch }, { page = 1, limit = 10, status = null } = {}) {
    try {
      dispatch('setLoading', true, { root: true });
      
      let url = `/api/extraction/patents?page=${page}&limit=${limit}`;
      if (status) {
        url += `&status=${status}`;
      }
      
      const response = await axios.get(url);
      
      if (response.data.success) {
        commit('SET_PATENTS', {
          patents: response.data.data.patents,
          pagination: response.data.data.pagination
        });
      }
      
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '获取专利列表失败，请稍后重试';
      dispatch('setError', message, { root: true });
      throw error;
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  },
  
  // 获取专利详情
  async fetchPatentDetails({ commit, dispatch }, id) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.get(`/api/extraction/patents/${id}`);
      
      if (response.data.success) {
        commit('SET_CURRENT_PATENT', response.data.data.patent);
        commit('SET_MOLECULES', response.data.data.molecules);
        commit('SET_REACTIONS', response.data.data.reactions);
        commit('SET_MOLECULES_TOTAL', response.data.data.moleculesTotal);
        commit('SET_REACTIONS_TOTAL', response.data.data.reactionsTotal);
      }
      
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '获取专利详情失败，请稍后重试';
      dispatch('setError', message, { root: true });
      throw error;
    } finally {
      dispatch('setLoading', false, { root: true });
    }
  },
  
  // 删除专利
  async deletePatent({ commit, dispatch }, id) {
    try {
      dispatch('setLoading', true, { root: true });
      const response = await axios.delete(`/api/extraction/patents/${id}`);
      
      if (response.data.success) {
        commit('REMOVE_PATENT', id);
        dispatch('setNotification', {
          type: 'success',
          message: '专利已成功删除'
        }, { root: true });
      }
      
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || '删除专利失败，请稍后重试';
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
