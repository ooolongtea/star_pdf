<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <AppHeader v-if="isAuthenticated" />
    <main :class="{ 'container mx-auto px-4 py-6': !isChatRoute }">
      <router-view />
    </main>
    <AppFooter v-if="isAuthenticated && !isChatRoute" />

    <!-- 错误提示 -->
    <ErrorAlert />

    <!-- 通知提示 -->
    <NotificationAlert />
  </div>
</template>

<script>
import { computed, onMounted } from "vue";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import axios from "./plugins/axios";
import AppHeader from "./components/common/AppHeader.vue";
import AppFooter from "./components/common/AppFooter.vue";
import ErrorAlert from "./components/common/ErrorAlert.vue";
import NotificationAlert from "./components/common/Notification.vue";

export default {
  name: "App",
  components: {
    AppHeader,
    AppFooter,
    ErrorAlert,
    NotificationAlert,
  },
  setup() {
    const store = useStore();
    const route = useRoute();
    const isAuthenticated = computed(
      () => store.getters["auth/isAuthenticated"]
    );
    const isChatRoute = computed(() => route.path === "/chat");

    onMounted(async () => {
      // 检查本地存储中的令牌
      const token = localStorage.getItem("token");
      if (token) {
        try {
          console.log("应用启动，开始验证令牌...");
          // 验证令牌并等待完成
          const result = await store.dispatch("auth/verifyToken", token);
          console.log("令牌验证结果:", result ? "成功" : "失败");

          // 如果验证成功，确保设置请求头
          if (result) {
            axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          }
        } catch (error) {
          console.error("令牌验证失败:", error);
        }
      } else {
        console.log("未找到令牌，用户未登录");
      }
    });

    return {
      isAuthenticated,
      isChatRoute,
    };
  },
};
</script>

<style>
/* 全局样式可以在这里添加 */
</style>
