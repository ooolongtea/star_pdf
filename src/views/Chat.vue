<template>
  <div class="h-screen flex flex-col">
    <div class="flex-1 flex overflow-hidden">
      <!-- 侧边栏 -->
      <div class="w-64 flex-shrink-0 hidden md:block">
        <ChatSidebar @new-chat="createNewChat" />
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
        <div class="fixed inset-0 bg-gray-600 bg-opacity-75" aria-hidden="true"></div>
        
        <div
          class="relative flex-1 flex flex-col max-w-xs w-full bg-gray-800"
          @click.stop
        >
          <div class="absolute top-0 right-0 -mr-12 pt-2">
            <button
              @click="showSidebar = false"
              class="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            >
              <span class="sr-only">关闭侧边栏</span>
              <svg
                class="h-6 w-6 text-white"
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
      <div class="flex-1 flex flex-col overflow-hidden">
        <ChatInterface @new-chat="createNewChat" />
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';
import { useStore } from 'vuex';
import ChatSidebar from '../components/chat/ChatSidebar.vue';
import ChatInterface from '../components/chat/ChatInterface.vue';

export default {
  name: 'ChatView',
  components: {
    ChatSidebar,
    ChatInterface
  },
  setup() {
    const store = useStore();
    const showSidebar = ref(false);
    
    // 创建新对话
    const createNewChat = async (modelName = 'qwen') => {
      try {
        // 清除当前对话
        store.dispatch('chat/clearCurrentConversation');
        
        // 创建新对话
        await store.dispatch('chat/createConversation', {
          title: '新对话',
          model_name: modelName
        });
        
        // 关闭移动端侧边栏
        showSidebar.value = false;
      } catch (error) {
        console.error('创建新对话失败:', error);
        store.dispatch('setError', '创建新对话失败，请确保您已配置相应模型的API密钥');
      }
    };
    
    return {
      showSidebar,
      createNewChat
    };
  }
};
</script>
