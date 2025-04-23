<template>
  <div class="h-screen flex flex-col bg-white">
    <div class="flex-1 flex overflow-hidden">
      <!-- 侧边栏 -->
      <div
        :class="[
          'flex-shrink-0 hidden md:block border-r border-gray-200 overflow-hidden transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'w-16' : 'w-1/4 max-w-xs',
        ]"
      >
        <div class="relative h-full">
          <ChatSidebar
            @new-chat="createNewChat"
            :collapsed="sidebarCollapsed"
          />

          <!-- 收起/展开按钮 -->
          <button
            @click="sidebarCollapsed = !sidebarCollapsed"
            class="absolute bottom-4 right-2 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 focus:outline-none transition-all duration-200"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                v-if="!sidebarCollapsed"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              ></path>
              <path
                v-else
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              ></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- 移动端侧边栏切换按钮 -->
      <div class="md:hidden absolute top-4 left-4 z-10">
        <button
          @click="showSidebar = !showSidebar"
          class="p-2 rounded-md text-gray-500 bg-white shadow-md hover:text-gray-600 focus:outline-none"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              v-if="!showSidebar"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            ></path>
            <path
              v-else
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>

      <!-- 移动端侧边栏 -->
      <div
        v-if="showSidebar"
        class="md:hidden fixed inset-0 z-20 flex"
        @click="showSidebar = false"
      >
        <div
          class="fixed inset-0 bg-gray-600 bg-opacity-75 backdrop-blur-sm transition-opacity duration-300"
          aria-hidden="true"
        ></div>

        <div
          class="relative flex-1 flex flex-col max-w-xs w-full bg-white border-r border-gray-200 overflow-hidden transition-transform duration-300 ease-in-out"
          @click.stop
        >
          <div class="absolute top-0 right-0 -mr-12 pt-2">
            <button
              @click="showSidebar = false"
              class="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <span class="sr-only">关闭侧边栏</span>
              <svg
                class="h-6 w-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>

          <ChatSidebar @new-chat="createNewChat" />
        </div>

        <div class="flex-shrink-0 w-14" aria-hidden="true">
          <!-- 强制侧边栏占用空间 -->
        </div>
      </div>

      <!-- 主聊天界面 -->
      <div
        class="flex-1 flex flex-col overflow-hidden bg-white transition-all duration-300 ease-in-out"
      >
        <ChatInterface @new-chat="createNewChat" />
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import { useStore } from "vuex";
import ChatSidebar from "../components/chat/ChatSidebar.vue";
import ChatInterface from "../components/chat/ChatInterface.vue";

export default {
  name: "ChatView",
  components: {
    ChatSidebar,
    ChatInterface,
  },
  setup() {
    const store = useStore();
    const showSidebar = ref(false);
    const sidebarCollapsed = ref(false);

    // 创建新对话
    const createNewChat = async (modelName = "qwen") => {
      try {
        // 清除当前对话
        store.dispatch("chat/clearCurrentConversation");

        // 创建新对话
        await store.dispatch("chat/createConversation", {
          title: "新对话",
          model_name: modelName,
        });

        // 关闭移动端侧边栏
        showSidebar.value = false;
      } catch (error) {
        console.error("创建新对话失败:", error);
        store.dispatch(
          "setError",
          "创建新对话失败，请确保您已配置相应模型的API密钥"
        );
      }
    };

    return {
      showSidebar,
      sidebarCollapsed,
      createNewChat,
    };
  },
};
</script>

<style scoped>
/* 添加现代化过渡效果 */
.shadow-sm {
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

/* 添加动画效果 */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}

/* 定义字体 */
.h-screen {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  color: #333;
}
</style>
