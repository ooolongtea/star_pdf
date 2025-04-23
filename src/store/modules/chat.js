import axios from '../../plugins/axios';

// 初始状态
const state = {
  conversations: [],
  currentConversation: null,
  messages: [],
  loading: false,
  error: null,
  modelOptions: [
    { value: 'qwen', label: '通义千问 (Qwen)' },
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'baichuan', label: '百川 (Baichuan)' },
    { value: 'chatglm', label: '智谱 (ChatGLM)' }
  ]
};

// 获取器
const getters = {
  getConversations: state => state.conversations,
  getCurrentConversation: state => state.currentConversation,
  getMessages: state => state.messages,
  isLoading: state => state.loading,
  getError: state => state.error,
  getModelOptions: state => state.modelOptions
};

// 修改器
const mutations = {
  SET_CONVERSATIONS(state, conversations) {
    state.conversations = conversations;
  },
  SET_CURRENT_CONVERSATION(state, conversation) {
    state.currentConversation = conversation;
  },
  SET_MESSAGES(state, messages) {
    state.messages = messages;
  },
  ADD_MESSAGE(state, message) {
    state.messages.push(message);
  },
  ADD_CONVERSATION(state, conversation) {
    state.conversations.unshift(conversation);
  },
  UPDATE_CONVERSATION(state, { id, title }) {
    const index = state.conversations.findIndex(conv => conv.id === id);
    if (index !== -1) {
      state.conversations[index].title = title;
      if (state.currentConversation && state.currentConversation.id === id) {
        state.currentConversation.title = title;
      }
    }
  },
  REMOVE_CONVERSATION(state, id) {
    state.conversations = state.conversations.filter(conv => conv.id !== id);
    if (state.currentConversation && state.currentConversation.id === id) {
      state.currentConversation = null;
      state.messages = [];
    }
  },
  SET_LOADING(state, loading) {
    state.loading = loading;
  },
  SET_ERROR(state, error) {
    state.error = error;
  },
  CLEAR_ERROR(state) {
    state.error = null;
  }
};

// 动作
const actions = {
  // 获取所有对话
  async fetchConversations({ commit }) {
    try {
      commit('SET_LOADING', true);
      commit('CLEAR_ERROR');
      
      const response = await axios.get('/api/chat/conversations');
      
      if (response.data.success) {
        commit('SET_CONVERSATIONS', response.data.data.conversations);
      }
    } catch (error) {
      console.error('获取对话列表失败:', error);
      commit('SET_ERROR', '获取对话列表失败，请稍后重试');
    } finally {
      commit('SET_LOADING', false);
    }
  },
  
  // 创建新对话
  async createConversation({ commit }, { title, model_name }) {
    try {
      commit('SET_LOADING', true);
      commit('CLEAR_ERROR');
      
      const response = await axios.post('/api/chat/conversations', {
        title: title || '新对话',
        model_name
      });
      
      if (response.data.success) {
        const conversation = response.data.data.conversation;
        commit('ADD_CONVERSATION', conversation);
        commit('SET_CURRENT_CONVERSATION', conversation);
        commit('SET_MESSAGES', []);
        return conversation;
      }
    } catch (error) {
      console.error('创建对话失败:', error);
      commit('SET_ERROR', '创建对话失败，请稍后重试');
      throw error;
    } finally {
      commit('SET_LOADING', false);
    }
  },
  
  // 获取特定对话及其消息
  async fetchConversation({ commit }, id) {
    try {
      commit('SET_LOADING', true);
      commit('CLEAR_ERROR');
      
      const response = await axios.get(`/api/chat/conversations/${id}`);
      
      if (response.data.success) {
        commit('SET_CURRENT_CONVERSATION', response.data.data.conversation);
        commit('SET_MESSAGES', response.data.data.messages);
      }
    } catch (error) {
      console.error('获取对话详情失败:', error);
      commit('SET_ERROR', '获取对话详情失败，请稍后重试');
    } finally {
      commit('SET_LOADING', false);
    }
  },
  
  // 更新对话标题
  async updateConversationTitle({ commit }, { id, title }) {
    try {
      commit('SET_LOADING', true);
      commit('CLEAR_ERROR');
      
      const response = await axios.put(`/api/chat/conversations/${id}`, { title });
      
      if (response.data.success) {
        commit('UPDATE_CONVERSATION', { id, title });
      }
    } catch (error) {
      console.error('更新对话标题失败:', error);
      commit('SET_ERROR', '更新对话标题失败，请稍后重试');
    } finally {
      commit('SET_LOADING', false);
    }
  },
  
  // 删除对话
  async deleteConversation({ commit }, id) {
    try {
      commit('SET_LOADING', true);
      commit('CLEAR_ERROR');
      
      const response = await axios.delete(`/api/chat/conversations/${id}`);
      
      if (response.data.success) {
        commit('REMOVE_CONVERSATION', id);
      }
    } catch (error) {
      console.error('删除对话失败:', error);
      commit('SET_ERROR', '删除对话失败，请稍后重试');
    } finally {
      commit('SET_LOADING', false);
    }
  },
  
  // 发送消息
  async sendMessage({ commit, state }, { conversationId, message }) {
    try {
      if (!state.currentConversation) {
        throw new Error('没有选择对话');
      }
      
      // 立即添加用户消息到UI
      const userMessage = {
        id: 'temp-' + Date.now(),
        conversation_id: conversationId,
        role: 'user',
        content: message,
        created_at: new Date().toISOString()
      };
      commit('ADD_MESSAGE', userMessage);
      
      // 添加临时的AI消息（用于显示加载状态）
      const tempAiMessage = {
        id: 'temp-ai-' + Date.now(),
        conversation_id: conversationId,
        role: 'assistant',
        content: '正在思考...',
        isLoading: true,
        created_at: new Date().toISOString()
      };
      commit('ADD_MESSAGE', tempAiMessage);
      
      // 发送请求到服务器
      const response = await axios.post(`/api/chat/conversations/${conversationId}/messages`, {
        message
      });
      
      if (response.data.success) {
        // 移除临时AI消息
        commit('SET_MESSAGES', state.messages.filter(msg => msg.id !== tempAiMessage.id));
        
        // 添加真实的AI回复
        commit('ADD_MESSAGE', response.data.data.message);
        
        return response.data.data.message;
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      
      // 移除临时AI消息，添加错误消息
      if (state.messages.some(msg => msg.id === 'temp-ai-' + Date.now())) {
        commit('SET_MESSAGES', state.messages.filter(msg => !msg.isLoading));
        
        const errorMessage = {
          id: 'error-' + Date.now(),
          conversation_id: conversationId,
          role: 'assistant',
          content: `发送消息失败: ${error.response?.data?.message || error.message}`,
          isError: true,
          created_at: new Date().toISOString()
        };
        commit('ADD_MESSAGE', errorMessage);
      }
      
      commit('SET_ERROR', '发送消息失败，请稍后重试');
      throw error;
    }
  },
  
  // 清除当前对话
  clearCurrentConversation({ commit }) {
    commit('SET_CURRENT_CONVERSATION', null);
    commit('SET_MESSAGES', []);
  }
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
};
