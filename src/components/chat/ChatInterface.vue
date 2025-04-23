<template>
  <div class="h-full flex flex-col relative">
    <!-- 聊天头部 -->
    <div
      class="flex items-center justify-between p-4 border-b bg-white sticky top-0 z-10 shadow-sm"
    >
      <div class="flex items-center">
        <h2 class="text-lg font-medium text-gray-900">
          {{ currentConversation ? currentConversation.title : "新对话" }}
        </h2>
        <span
          v-if="currentConversation"
          class="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center"
        >
          <span
            class="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"
          ></span>
          {{ getModelDisplayName(currentConversation.model_name) }}
        </span>
      </div>

      <div class="flex items-center space-x-2">
        <button
          v-if="messages.length > 0"
          @click="onNewChat"
          class="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
        >
          <svg
            class="h-4 w-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            ></path>
          </svg>
          新对话
        </button>
      </div>
    </div>

    <!-- 聊天消息区域 -->
    <div
      class="flex-1 overflow-y-auto px-4 py-1 bg-white pb-28"
      ref="messagesContainer"
    >
      <div
        v-if="!currentConversation && messages.length === 0"
        class="h-full flex flex-col items-center justify-center text-gray-500"
      >
        <svg
          class="h-16 w-16 mb-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          ></path>
        </svg>
        <p class="text-lg">选择一个对话或开始新对话</p>
        <p class="text-sm mt-2">您可以与AI助手进行对话，获取帮助和信息</p>
      </div>

      <div v-else>
        <MessageItem
          v-for="message in messages"
          :key="message.id"
          :message="message"
        />
      </div>
    </div>

    <!-- 输入区域（固定在底部） -->
    <div
      class="p-4 border-t bg-white shadow-md fixed bottom-0 left-0 right-0 transition-all duration-300 ease-in-out z-10 md:absolute"
    >
      <form @submit.prevent="sendMessage" class="flex items-end relative">
        <!-- 模型指示器 -->
        <div
          class="absolute -top-8 left-0 text-xs text-gray-500 flex items-center bg-gray-50 px-2 py-1 rounded-t-md border border-gray-200 border-b-0"
        >
          <span
            class="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse"
          ></span>
          <span
            :key="currentConversation ? currentConversation.model_name : 'none'"
            >{{
              currentConversation
                ? getModelDisplayName(currentConversation.model_name)
                : "未选择模型"
            }}</span
          >
          <!-- 模型调试信息 -->
          <span class="text-xs text-gray-400 ml-2">
            ({{
              currentConversation ? currentConversation.model_name : "none"
            }})
          </span>
        </div>
        <div class="flex-1 min-h-[40px]">
          <textarea
            v-model="messageInput"
            @keydown.enter.exact.prevent="sendMessage"
            placeholder="输入消息，按Enter发送，Shift+Enter换行..."
            class="w-full border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none transition-all duration-200 font-sans text-base"
            :rows="textareaRows"
            :disabled="!currentConversation || loading"
            ref="messageTextarea"
          ></textarea>
        </div>
        <button
          type="submit"
          class="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transform transition-transform duration-200 hover:scale-105 active:scale-95"
          :disabled="!messageInput.trim() || !currentConversation || loading"
        >
          <svg
            v-if="!loading"
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            ></path>
          </svg>
          <svg
            v-else
            class="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </button>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { useStore } from "vuex";
import MessageItem from "./MessageItem.vue";

export default {
  name: "ChatInterface",
  components: {
    MessageItem,
  },
  emits: ["new-chat"],
  setup(props, { emit }) {
    const store = useStore();
    const messageInput = ref("");
    const messagesContainer = ref(null);
    const messageTextarea = ref(null);

    // 从Vuex获取数据
    const currentConversation = computed(
      () => store.getters["chat/getCurrentConversation"]
    );
    const messages = computed(() => store.getters["chat/getMessages"]);
    const loading = computed(() => store.getters["chat/isLoading"]);

    // 计算文本区域的行数
    const textareaRows = computed(() => {
      const lines = messageInput.value.split("\n").length;
      return Math.min(Math.max(1, lines), 5); // 最小1行，最大5行
    });

    // 监听消息变化，自动滚动到底部
    watch(messages, () => {
      scrollToBottom();
    });

    // 监听当前对话变化，聚焦输入框
    watch(currentConversation, (newVal, oldVal) => {
      console.log("当前对话变化:", newVal, oldVal);
      if (newVal) {
        console.log("当前对话模型:", newVal.model_name);
        console.log("模型显示名称:", getModelDisplayName(newVal.model_name));
      }

      nextTick(() => {
        if (messageTextarea.value) {
          messageTextarea.value.focus();
        }
      });
    });

    // 组件挂载后聚焦输入框
    onMounted(() => {
      if (messageTextarea.value) {
        messageTextarea.value.focus();
      }
    });

    // 滚动到底部
    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop =
            messagesContainer.value.scrollHeight;
        }
      });
    };

    // 发送消息
    const sendMessage = async () => {
      if (!messageInput.value.trim() || !currentConversation.value) return;

      const message = messageInput.value;
      messageInput.value = "";

      // 添加按钮动画效果
      const sendButton = document.querySelector('button[type="submit"]');
      if (sendButton) {
        sendButton.classList.add("animate-send-pulse");
        setTimeout(() => {
          sendButton.classList.remove("animate-send-pulse");
        }, 500);
      }

      try {
        await store.dispatch("chat/sendMessage", {
          conversationId: currentConversation.value.id,
          message,
        });
      } catch (error) {
        console.error("发送消息失败:", error);
      }
    };

    // 新建对话
    const onNewChat = () => {
      emit("new-chat");
    };

    // 获取模型显示名称
    const getModelDisplayName = (modelName) => {
      // 如果模型名称为空，返回默认值
      if (!modelName) {
        return "未选择模型";
      }

      // 处理新格式的模型名称（provider:model）
      if (modelName.includes(":")) {
        const [providerId, modelId] = modelName.split(":");

        // 获取厂商名称
        const providerMap = {
          qwen: "通义千问",
          deepseek: "DeepSeek",
          baichuan: "百川",
          chatglm: "智谱",
        };

        const providerName = providerMap[providerId] || providerId;

        // 获取模型名称
        const modelMap = {
          "qwen-max": "Qwen-Max",
          "qwen-max-longcontext": "Qwen-Max-Long",
          "qwen-vl-max": "Qwen-VL-Max",
          "qwen-32b": "Qwen-32B",
          "deepseek-chat": "DeepSeek Chat",
          "deepseek-reasoner": "DeepSeek Reasoner",
          "baichuan-turbo": "Baichuan Turbo",
          "chatglm-turbo": "ChatGLM Turbo",
        };

        const displayModelName = modelMap[modelId] || modelId;

        return `${providerName} - ${displayModelName}`;
      }

      // 兼容旧格式
      const modelMap = {
        qwen: "通义千问 (Qwen)",
        deepseek: "DeepSeek",
        baichuan: "百川 (Baichuan)",
        chatglm: "智谱 (ChatGLM)",
        other: "其他",
      };

      return modelMap[modelName] || modelName;
    };

    return {
      messageInput,
      messagesContainer,
      messageTextarea,
      currentConversation,
      messages,
      loading,
      textareaRows,
      sendMessage,
      onNewChat,
      getModelDisplayName,
    };
  },
};
</script>

<style scoped>
/* 自定义滚动条 */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  @apply bg-gray-100;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  @apply bg-gray-300 rounded;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400;
}

/* 文本区域样式 */
textarea {
  min-height: 40px;
  max-height: 150px;
}

/* 固定底部输入区域样式 */
.fixed.bottom-0,
.absolute.bottom-0 {
  box-shadow: 0 -2px 4px -1px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(229, 231, 235, 0.8);
}

/* 添加圆角和过渡效果 */
.rounded-t-lg {
  border-top-left-radius: 0.75rem;
  border-top-right-radius: 0.75rem;
}

.rounded-b-lg {
  border-bottom-left-radius: 0.75rem;
  border-bottom-right-radius: 0.75rem;
}

.shadow-sm {
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.shadow-lg {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* 添加过渡效果 */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}

.transition-colors {
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* 发送按钮动画 */
@keyframes sendPulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

.animate-send-pulse {
  animation: sendPulse 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
