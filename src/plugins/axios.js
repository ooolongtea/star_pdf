import axios from 'axios';
import store from '../store';
import router from '../router';

// 创建axios实例
const instance = axios.create({
  baseURL: process.env.VUE_APP_API_URL || 'http://localhost:3000',
  timeout: 60000, // 60秒超时
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
instance.interceptors.request.use(
  config => {
    // 从localStorage获取token
    const token = localStorage.getItem('token');
    
    // 如果有token，添加到请求头
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    // 处理错误响应
    if (error.response) {
      // 服务器返回错误状态码
      const { status, data } = error.response;
      
      // 处理401未授权错误
      if (status === 401) {
        // 清除认证状态
        store.commit('auth/CLEAR_AUTH');
        
        // 如果不是登录页面，重定向到登录页
        if (router.currentRoute.value.name !== 'Login') {
          router.push({
            name: 'Login',
            query: { redirect: router.currentRoute.value.fullPath }
          });
        }
      }
      
      // 显示错误消息
      if (data && data.message) {
        store.dispatch('setError', data.message);
      } else {
        store.dispatch('setError', '请求失败，请稍后重试');
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      store.dispatch('setError', '无法连接到服务器，请检查网络连接');
    } else {
      // 请求配置出错
      store.dispatch('setError', '请求配置错误');
    }
    
    return Promise.reject(error);
  }
);

export default instance;
