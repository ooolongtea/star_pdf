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
      </div>

      <!-- ChatGPT风格的输入区域 -->
      <form @submit.prevent="sendMessage" class="relative">
        <div
          class="relative border border-gray-300 rounded-xl shadow-sm bg-white overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all duration-200"
        >
          <!-- 文本输入区域 -->
          <div class="flex-1 min-h-[40px] p-2">
            <textarea
              v-model="messageInput"
              @keydown.enter.exact.prevent="sendMessage"
              placeholder="发送消息给AI助手..."
              class="w-full border-0 focus:ring-0 resize-none transition-all duration-200 font-sans text-base p-0 max-h-[200px] overflow-y-auto"
              :rows="textareaRows"
              :disabled="!currentConversation || loading"
              ref="messageTextarea"
            ></textarea>
          </div>

          <!-- 底部工具栏 -->
          <div
            class="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50"
          >
            <!-- 左侧工具 -->
            <div class="flex items-center space-x-2">
              <!-- 图片上传组件 -->
              <div class="relative group">
                <ImageUploader
                  ref="imageUploader"
                  :disabled="!currentConversation || loading || !isVisualModel"
                  @image-selected="onImageSelected"
                  @image-removed="onImageRemoved"
                />
                <!-- 图片大小提示 - 悬浮显示 -->
                <div
                  v-if="isVisualModel"
                  class="absolute bottom-full mb-1 left-0 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow-sm border border-gray-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  图片限制: &lt;10MB
                </div>
              </div>

              <!-- 已选图片预览 -->
              <div v-if="selectedImage" class="relative">
                <div
                  class="w-8 h-8 rounded-md overflow-hidden border border-gray-300"
                >
                  <img
                    :src="selectedImage"
                    class="w-full h-full object-cover"
                  />
                  <button
                    @click.prevent="onImageRemoved"
                    class="absolute -top-1 -right-1 bg-gray-100 rounded-full p-0.5 shadow-sm hover:bg-gray-200 transition-colors"
                  >
                    <svg
                      class="w-3 h-3 text-gray-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- 发送按钮 -->
            <button
              type="submit"
              class="inline-flex items-center justify-center w-8 h-8 rounded-full text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200"
              :disabled="
                (!messageInput.trim() && !selectedImage) ||
                !currentConversation ||
                loading
              "
              :class="{ 'scale-110': loading }"
            >
              <svg
                v-if="!loading"
                class="h-4 w-4"
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
                class="animate-spin h-4 w-4"
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
          </div>
        </div>

        <!-- 底部提示 -->
        <div class="text-xs text-center text-gray-500 mt-2">
          AI可能会产生不准确的信息。请谨慎使用AI生成的内容。
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { useStore } from "vuex";
import MessageItem from "./MessageItem.vue";
import ImageUploader from "./ImageUploader.vue";

export default {
  name: "ChatInterface",
  components: {
    MessageItem,
    ImageUploader,
  },
  emits: ["new-chat"],
  setup(props, { emit }) {
    const store = useStore();
    const messageInput = ref("");
    const messagesContainer = ref(null);
    const messageTextarea = ref(null);
    const selectedImage = ref(null);
    const selectedImageData = ref(null);
    // eslint-disable-next-line no-unused-vars
    const imageUploader = ref(null);

    // 从Vuex获取数据
    const currentConversation = computed(
      () => store.getters["chat/getCurrentConversation"]
    );
    const messages = computed(() => store.getters["chat/getMessages"]);
    const loading = computed(() => store.getters["chat/isLoading"]);

    // 检查当前模型是否支持图片输入
    const isVisualModel = computed(() => {
      if (!currentConversation.value || !currentConversation.value.model_name) {
        return false;
      }

      const modelName = currentConversation.value.model_name.toLowerCase();
      return (
        modelName.includes("vl") ||
        modelName.includes("vision") ||
        modelName.includes("visual")
      );
    });

    // 计算文本区域的行数
    const textareaRows = computed(() => {
      const lines = messageInput.value.split("\n").length;
      return Math.min(Math.max(1, lines), 5); // 最小1行，最大5行
    });

    // 处理图片选择
    const onImageSelected = (imageData) => {
      selectedImage.value = imageData.dataUrl;
      selectedImageData.value = imageData.dataUrl;
    };

    // 处理图片移除
    const onImageRemoved = () => {
      selectedImage.value = null;
      selectedImageData.value = null;
    };

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
      // 检查是否有消息内容或图片
      if (
        (!messageInput.value.trim() && !selectedImageData.value) ||
        !currentConversation.value
      )
        return;

      const message = messageInput.value;
      const imageData = selectedImageData.value;

      // 清空输入
      messageInput.value = "";
      selectedImage.value = null;
      selectedImageData.value = null;

      // 重置图片上传组件
      if (imageUploader.value) {
        imageUploader.value.reset();
      }

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
          image: imageData,
        });
      } catch (error) {
        console.error("发送消息失败:", error);

        // 显示更友好的错误消息
        let errorMessage = "发送消息失败";

        if (
          error.message &&
          error.message.includes("request entity too large")
        ) {
          errorMessage =
            "图片太大，超过了服务器限制。请使用更小的图片或进一步压缩。";
        } else if (
          error.response &&
          error.response.data &&
          error.response.data.message
        ) {
          errorMessage = `发送消息失败: ${error.response.data.message}`;
        } else if (error.message) {
          errorMessage = `发送消息失败: ${error.message}`;
        }

        alert(errorMessage);
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
      selectedImage,
      isVisualModel,
      onImageSelected,
      onImageRemoved,
      imageUploader,
    };
  },
};
</script>

<style scoped>
/* 自定义滚动条 - 更细腻的滚动条 */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  @apply bg-transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  @apply bg-gray-300 rounded-full;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400;
}

/* 文本区域样式 - 更现代的输入框 */
textarea {
  min-height: 24px;
  max-height: 200px;
  line-height: 1.5;
  font-size: 1rem;
  outline: none !important;
  box-shadow: none !important;
}

textarea:focus {
  outline: none !important;
  box-shadow: none !important;
}

/* 固定底部输入区域样式 - 更精致的阴影和模糊效果 */
.fixed.bottom-0,
.absolute.bottom-0 {
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(229, 231, 235, 0.8);
}

/* 消息气泡样式 - 更现代的圆角和阴影 */
.message-bubble {
  border-radius: 1rem;
  overflow: hidden;
  transition: all 0.2s ease;
}

.message-bubble:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

/* 用户消息气泡 */
.user-message {
  background-color: #e9f2ff;
  border: 1px solid #d1e4ff;
}

/* AI消息气泡 */
.ai-message {
  background-color: #f7f7f8;
  border: 1px solid #e5e7eb;
}

/* 输入框容器样式 - ChatGPT风格 */
.input-container {
  border-radius: 1rem;
  transition: all 0.2s ease;
  border: 1px solid #e5e7eb;
}

.input-container:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

/* 发送按钮动画 - 更平滑的动画 */
@keyframes sendPulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}

.animate-send-pulse {
  animation: sendPulse 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 工具栏按钮样式 */
.toolbar-button {
  @apply flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-200;
}

/* 添加消息加载动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-fade-in {
  animation: fadeIn 0.3s ease forwards;
}

/* 添加打字机效果 */
@keyframes typing {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

.typing-animation {
  display: inline-block;
  overflow: hidden;
  white-space: nowrap;
  animation: typing 1s steps(40, end);
}
</style>
