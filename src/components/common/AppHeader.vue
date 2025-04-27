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
            to="/chat"
            class="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
            :class="{ 'text-blue-600': isActive('/chat') }"
          >
            AI聊天
          </router-link>
          <router-link
            to="/pdf-converter"
            class="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
            :class="{ 'text-blue-600': isActive('/pdf-converter') }"
          >
            PDF转换
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
            id="user-menu-button"
            @click.stop="toggleUserMenu"
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
            @click.stop
            class="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 z-50"
          >
            <router-link
              to="/settings"
              class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              @click="userMenuOpen = false"
            >
              <span class="flex items-center">
                <svg
                  class="h-4 w-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  ></path>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  ></path>
                </svg>
                系统设置
              </span>
            </router-link>
            <router-link
              to="/account"
              class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              @click="userMenuOpen = false"
            >
              <span class="flex items-center">
                <svg
                  class="h-4 w-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  ></path>
                </svg>
                账号管理
              </span>
            </router-link>
            <router-link
              to="/api-keys"
              class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              @click="userMenuOpen = false"
            >
              <span class="flex items-center">
                <svg
                  class="h-4 w-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  ></path>
                </svg>
                API Key管理
              </span>
            </router-link>
            <div class="border-t border-gray-100 my-1"></div>
            <button
              @click="logout"
              class="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
            >
              <span class="flex items-center">
                <svg
                  class="h-4 w-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  ></path>
                </svg>
                退出登录
              </span>
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
        class="md:hidden py-2 border-t border-gray-200 relative z-50"
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
          to="/chat"
          class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
          :class="{ 'text-blue-600 bg-gray-50': isActive('/chat') }"
          @click="mobileMenuOpen = false"
        >
          <span class="flex items-center">
            <svg
              class="h-5 w-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              ></path>
            </svg>
            AI聊天
          </span>
        </router-link>
        <router-link
          to="/pdf-converter"
          class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
          :class="{ 'text-blue-600 bg-gray-50': isActive('/pdf-converter') }"
          @click="mobileMenuOpen = false"
        >
          <span class="flex items-center">
            <svg
              class="h-5 w-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              ></path>
            </svg>
            PDF转换
          </span>
        </router-link>
        <router-link
          to="/settings"
          class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
          :class="{ 'text-blue-600 bg-gray-50': isActive('/settings') }"
          @click="mobileMenuOpen = false"
        >
          <span class="flex items-center">
            <svg
              class="h-5 w-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              ></path>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              ></path>
            </svg>
            系统设置
          </span>
        </router-link>
        <router-link
          to="/account"
          class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
          :class="{ 'text-blue-600 bg-gray-50': isActive('/account') }"
          @click="mobileMenuOpen = false"
        >
          <span class="flex items-center">
            <svg
              class="h-5 w-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              ></path>
            </svg>
            账号管理
          </span>
        </router-link>
        <router-link
          to="/api-keys"
          class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
          :class="{ 'text-blue-600 bg-gray-50': isActive('/api-keys') }"
          @click="mobileMenuOpen = false"
        >
          <span class="flex items-center">
            <svg
              class="h-5 w-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              ></path>
            </svg>
            API Key管理
          </span>
        </router-link>
        <div class="border-t border-gray-200 my-1"></div>
        <button
          @click="logout"
          class="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-700 hover:bg-gray-50"
        >
          <span class="flex items-center">
            <svg
              class="h-5 w-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              ></path>
            </svg>
            退出登录
          </span>
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
      userMenuOpen.value = false;
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
