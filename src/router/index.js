import { createRouter, createWebHistory } from 'vue-router';
import store from '../store';

// 页面组件
import Home from '../views/Home.vue';
import Login from '../views/Login.vue';
import Register from '../views/Register.vue';
import Dashboard from '../views/Dashboard.vue';
import Extraction from '../views/Extraction.vue';
import Results from '../views/Results.vue';
import PatentDetail from '../views/PatentDetail.vue';
import Settings from '../views/Settings.vue';
import Account from '../views/Account.vue';
import ApiKeys from '../views/ApiKeys.vue';
import Chat from '../views/Chat.vue';
import PdfConverter from '../views/PdfConverter.vue';
import NotFound from '../views/NotFound.vue';

// 路由配置
const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { requiresAuth: false }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false, hideForAuth: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: Register,
    meta: { requiresAuth: false, hideForAuth: true }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/extraction',
    name: 'Extraction',
    component: Extraction,
    meta: { requiresAuth: true }
  },
  {
    path: '/results',
    name: 'Results',
    component: Results,
    meta: { requiresAuth: true },
    beforeEnter: (to, from, next) => {
      // 如果是从/patents/:id页面来的，直接返回
      if (from.path.startsWith('/patents/')) {
        next(false);
        return;
      }
      next();
    }
  },
  {
    path: '/patents/:id',
    name: 'PatentDetail',
    component: PatentDetail,
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
    meta: { requiresAuth: true }
  },
  {
    path: '/account',
    name: 'Account',
    component: Account,
    meta: { requiresAuth: true }
  },
  {
    path: '/api-keys',
    name: 'ApiKeys',
    component: ApiKeys,
    meta: { requiresAuth: true }
  },
  {
    path: '/chat',
    name: 'Chat',
    component: Chat,
    meta: { requiresAuth: true }
  },
  {
    path: '/pdf-converter',
    name: 'PdfConverter',
    component: PdfConverter,
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound
  }
];

// 创建路由
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  }
});

// 导航守卫
router.beforeEach(async (to, from, next) => {
  // 检查是否有令牌
  const token = localStorage.getItem('token');
  const isVerifying = store.getters['auth/isVerifyingToken'];
  const isAuthenticated = store.getters['auth/isAuthenticated'];

  console.log(`路由守卫: ${from.path} -> ${to.path}`);
  console.log(`认证状态: ${isAuthenticated ? '已登录' : '未登录'}, 令牌: ${token ? '存在' : '不存在'}, 验证中: ${isVerifying}`);

  // 如果有令牌但未认证，并且不在验证中，尝试验证令牌
  if (token && !isAuthenticated && !isVerifying) {
    console.log('在路由守卫中验证令牌');
    try {
      await store.dispatch('auth/verifyToken', token);
    } catch (error) {
      console.error('路由守卫中验证令牌失败:', error);
    }
  }

  // 重新获取认证状态（可能已经更新）
  const updatedIsAuthenticated = store.getters['auth/isAuthenticated'];

  // 需要认证但未登录
  if (to.meta.requiresAuth && !updatedIsAuthenticated) {
    console.log(`需要认证但未登录，重定向到登录页，目标路径: ${to.fullPath}`);
    next({ name: 'Login', query: { redirect: to.fullPath } });
    return;
  }

  // 已登录用户不应访问登录/注册页
  if (to.meta.hideForAuth && updatedIsAuthenticated) {
    console.log('已登录用户访问登录/注册页，重定向到仪表盘');
    next({ name: 'Dashboard' });
    return;
  }

  console.log(`允许访问: ${to.path}`);
  next();
});

export default router;
