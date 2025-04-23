<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <AppHeader v-if="isAuthenticated" />
    <main :class="{ 'container mx-auto px-4 py-6': !isChatRoute }">
      <router-view />
    </main>
    <AppFooter v-if="isAuthenticated && !isChatRoute" />
  </div>
</template>

<script>
import { computed, onMounted } from "vue";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import AppHeader from "./components/common/AppHeader.vue";
import AppFooter from "./components/common/AppFooter.vue";

export default {
  name: "App",
  components: {
    AppHeader,
    AppFooter,
  },
  setup() {
    const store = useStore();
    const route = useRoute();
    const isAuthenticated = computed(
      () => store.getters["auth/isAuthenticated"]
    );
    const isChatRoute = computed(() => route.path === "/chat");

    onMounted(() => {
      // 检查本地存储中的令牌
      const token = localStorage.getItem("token");
      if (token) {
        store.dispatch("auth/verifyToken", token);
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
