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
    meta: { requiresAuth: true }
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
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound
  }
];

// 创建路由
const router = createRouter({
  history: createWebHistory(),
  routes
});

// 导航守卫
router.beforeEach((to, from, next) => {
  const isAuthenticated = store.getters['auth/isAuthenticated'];

  // 需要认证但未登录
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
    return;
  }

  // 已登录用户不应访问登录/注册页
  if (to.meta.hideForAuth && isAuthenticated) {
    next({ name: 'Dashboard' });
    return;
  }

  next();
});

export default router;
