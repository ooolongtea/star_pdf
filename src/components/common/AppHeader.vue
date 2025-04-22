<template>
  <header class="bg-white shadow">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center py-4">
        <!-- Logo -->
        <div class="flex items-center">
          <router-link to="/dashboard" class="flex items-center">
            <svg
              class="h-8 w-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              ></path>
            </svg>
            <span class="ml-2 text-xl font-bold text-gray-900"
              >专利化学式提取系统</span
            >
          </router-link>
        </div>

        <!-- 导航菜单 -->
        <nav class="hidden md:flex space-x-8">
          <router-link
            to="/dashboard"
            class="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
            :class="{ 'text-blue-600': isActive('/dashboard') }"
          >
            仪表盘
          </router-link>
          <router-link
            to="/extraction"
            class="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
            :class="{ 'text-blue-600': isActive('/extraction') }"
          >
            化学式提取
          </router-link>
          <router-link
            to="/results"
            class="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
            :class="{ 'text-blue-600': isActive('/results') }"
          >
            提取结果
          </router-link>
          <router-link
            to="/settings"
            class="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
            :class="{ 'text-blue-600': isActive('/settings') }"
          >
            设置
          </router-link>
        </nav>

        <!-- 用户菜单 -->
        <div class="relative">
          <button
            @click="toggleUserMenu"
            class="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
          >
            <span class="mr-2">{{ user ? user.username : "用户" }}</span>
            <svg
              class="h-5 w-5 text-gray-400"
              :class="{ 'transform rotate-180': userMenuOpen }"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>

          <!-- 下拉菜单 -->
          <div
            v-if="userMenuOpen"
            class="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 z-10"
          >
            <router-link
              to="/settings"
              class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              @click="userMenuOpen = false"
            >
              设置
            </router-link>
            <button
              @click="logout"
              class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              退出登录
            </button>
          </div>
        </div>

        <!-- 移动端菜单按钮 -->
        <div class="md:hidden">
          <button
            @click="toggleMobileMenu"
            class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
          >
            <svg
              class="h-6 w-6"
              :class="{ hidden: mobileMenuOpen, block: !mobileMenuOpen }"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            <svg
              class="h-6 w-6"
              :class="{ block: mobileMenuOpen, hidden: !mobileMenuOpen }"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- 移动端菜单 -->
      <div
        v-if="mobileMenuOpen"
        class="md:hidden py-2 border-t border-gray-200"
      >
        <router-link
          to="/dashboard"
          class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
          :class="{ 'text-blue-600 bg-gray-50': isActive('/dashboard') }"
          @click="mobileMenuOpen = false"
        >
          仪表盘
        </router-link>
        <router-link
          to="/extraction"
          class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
          :class="{ 'text-blue-600 bg-gray-50': isActive('/extraction') }"
          @click="mobileMenuOpen = false"
        >
          化学式提取
        </router-link>
        <router-link
          to="/results"
          class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
          :class="{ 'text-blue-600 bg-gray-50': isActive('/results') }"
          @click="mobileMenuOpen = false"
        >
          提取结果
        </router-link>
        <router-link
          to="/settings"
          class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
          :class="{ 'text-blue-600 bg-gray-50': isActive('/settings') }"
          @click="mobileMenuOpen = false"
        >
          设置
        </router-link>
        <button
          @click="logout"
          class="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-red-600 hover:bg-gray-50"
        >
          退出登录
        </button>
      </div>
    </div>
  </header>
</template>

<script>
import { ref, computed } from "vue";
import { useStore } from "vuex";
import { useRouter, useRoute } from "vue-router";

export default {
  name: "AppHeader",
  setup() {
    const store = useStore();
    const router = useRouter();
    const route = useRoute();

    const user = computed(() => store.getters["auth/getUser"]);
    const userMenuOpen = ref(false);
    const mobileMenuOpen = ref(false);

    // 切换用户菜单
    const toggleUserMenu = () => {
      userMenuOpen.value = !userMenuOpen.value;
      if (userMenuOpen.value) {
        mobileMenuOpen.value = false;
      }
    };

    // 切换移动端菜单
    const toggleMobileMenu = () => {
      mobileMenuOpen.value = !mobileMenuOpen.value;
      if (mobileMenuOpen.value) {
        userMenuOpen.value = false;
      }
    };

    // 检查路由是否激活
    const isActive = (path) => {
      return route.path.startsWith(path);
    };

    // 退出登录
    const logout = async () => {
      try {
        await store.dispatch("auth/logout");
        router.push("/login");
      } catch (error) {
        console.error("退出登录失败:", error);
      }
    };

    // 点击外部关闭菜单
    const handleClickOutside = () => {
      if (userMenuOpen.value) {
        userMenuOpen.value = false;
      }
    };

    // 添加点击事件监听器
    if (typeof window !== "undefined") {
      window.addEventListener("click", handleClickOutside);
    }

    return {
      user,
      userMenuOpen,
      mobileMenuOpen,
      toggleUserMenu,
      toggleMobileMenu,
      isActive,
      logout,
    };
  },
};
</script>
