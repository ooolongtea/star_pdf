<template>
  <div class="h-full flex flex-col relative">
    <!-- 移除聊天头部，因为已经将模型选择器移到了主顶部栏 -->

    <!-- 聊天消息区域 - ChatGPT风格 -->
    <div
      class="flex-1 overflow-y-auto px-0 md:px-4 py-0 bg-gray-50 pb-4"
      ref="messagesContainer"
    >
      <div
        v-if="!currentConversation && messages.length === 0"
        class="h-full flex flex-col items-center justify-center text-gray-500"
      >
        <div
          class="bg-gradient-to-br from-indigo-50 to-blue-50 p-10 rounded-3xl shadow-lg border border-indigo-100 max-w-md text-center backdrop-blur-sm"
        >
          <div class="relative mb-8">
            <div
              class="absolute inset-0 bg-gradient-to-r from-indigo-400 to-blue-500 rounded-full opacity-20 blur-xl"
            ></div>
            <svg
              class="h-24 w-24 mx-auto relative z-10 text-indigo-500"
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
          </div>
          <h2 class="text-2xl font-medium text-indigo-900 mb-3 tracking-tight">
            开始一段新对话
          </h2>
          <p class="text-slate-600 mb-6 leading-relaxed">
            选择一个现有对话或创建新对话，开始与AI助手交流，探索无限可能
          </p>
          <button
            @click="onNewChat"
            class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md transition-all duration-300 transform hover:scale-105"
          >
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
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              ></path>
            </svg>
            新建对话
          </button>
        </div>
      </div>

      <div v-else class="py-2 space-y-4">
        <MessageItem
          v-for="message in messages"
          :key="message.id"
          :message="message"
        />
      </div>
    </div>

    <!-- 简化的输入区域 - 固定在底部的圆角矩形 -->
    <div class="fixed bottom-4 left-0 right-0 z-50">
      <form @submit.prevent="sendMessage" class="relative max-w-3xl mx-auto">
        <!-- 圆角矩形输入区域 -->
        <div
          class="relative rounded-xl border border-gray-200 shadow-md bg-gray-50 flex items-center"
          style="width: 75%; margin: 0 auto; min-height: 65px"
        >
          <!-- 左侧工具栏 -->
          <div class="flex items-center space-x-2 ml-3">
            <!-- 思考模式切换按钮 -->
            <div v-if="isThinkingModelSupported" class="relative group">
              <button
                @click="toggleThinkingMode"
                class="toolbar-button"
                :class="{
                  'bg-blue-100 text-blue-600 ring-2 ring-blue-200':
                    enableThinking,
                }"
                :title="enableThinking ? '关闭思考模式' : '开启思考模式'"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  ></path>
                </svg>
              </button>
            </div>

            <!-- 图片上传组件 -->
            <div class="relative group">
              <ImageUploader
                ref="imageUploader"
                :disabled="!currentConversation || loading || !isVisualModel"
                @image-selected="onImageSelected"
                @image-removed="onImageRemoved"
              />
            </div>

            <!-- 已选图片预览 -->
            <div v-if="selectedImage" class="relative">
              <div
                class="w-6 h-6 rounded-lg overflow-hidden border border-gray-200 shadow-sm"
              >
                <img :src="selectedImage" class="w-full h-full object-cover" />
                <button
                  @click.prevent="onImageRemoved"
                  class="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-md hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  <svg
                    class="w-2 h-2 text-gray-600"
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

          <!-- 文本输入区域 -->
          <div class="flex-1 min-h-[48px] relative mx-2">
            <textarea
              v-model="messageInput"
              @keydown.enter.exact.prevent="sendMessage"
              placeholder="发送消息..."
              class="w-full border-0 px-2 py-3 focus:ring-0 focus:outline-none resize-none transition-all duration-200 font-sans text-base max-h-[150px] overflow-y-auto overflow-x-hidden min-h-[24px] whitespace-normal break-words"
              style="word-wrap: break-word; word-break: break-word"
              rows="1"
              :disabled="!currentConversation || loading"
              ref="messageTextarea"
            ></textarea>
          </div>

          <!-- 发送按钮 -->
          <button
            type="submit"
            class="mr-3 inline-flex items-center justify-center w-8 h-8 rounded-md text-white bg-gray-800 hover:bg-gray-700 focus:outline-none disabled:opacity-40 disabled:bg-gray-400 transition-colors duration-200"
            :disabled="
              (!messageInput.trim() && !selectedImage) ||
              !currentConversation ||
              loading
            "
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
                d="M5 12h14M12 5l7 7-7 7"
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

        <!-- 底部提示 - 固定在最下方 -->
        <div class="text-xs text-center text-gray-500 mt-2 font-medium">
          AI也可能会犯错。请核查重要信息。
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

    // 检查当前模型是否支持思考模式
    const isThinkingModelSupported = computed(() => {
      if (!currentConversation.value || !currentConversation.value.model_name) {
        return false;
      }

      const modelName = currentConversation.value.model_name.toLowerCase();
      return modelName.includes("qwen3") || modelName.includes("qwq");
    });

    // 思考模式状态
    const enableThinking = ref(false);

    // 切换思考模式
    const toggleThinkingMode = () => {
      enableThinking.value = !enableThinking.value;
    };

    // 监听模型变化，自动设置思考模式
    watch(
      currentConversation,
      (newVal) => {
        if (newVal && newVal.model_name) {
          const modelName = newVal.model_name.toLowerCase();

          // QwQ模型自动启用思考模式
          if (modelName.includes("qwq")) {
            enableThinking.value = true;
          }
          // qwen3-235b-a22b模型默认启用思考模式
          else if (
            modelName.includes("qwen3") &&
            modelName.includes("235b-a22b")
          ) {
            enableThinking.value = true;
          } else {
            // 其他模型默认关闭思考模式
            enableThinking.value = false;
          }
        }
      },
      { immediate: true }
    );

    // 计算文本区域的行数
    const textareaRows = computed(() => {
      const lines = messageInput.value.split("\n").length;
      return Math.min(Math.max(2, lines), 5); // 最小2行，最大5行
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

    // 组件挂载后聚焦输入框并滚动到底部
    onMounted(() => {
      if (messageTextarea.value) {
        messageTextarea.value.focus();
      }

      // 确保初始加载时滚动到底部
      if (messages.value.length > 0) {
        scrollToBottom();
      }
    });

    // 滚动到底部 - 简化版，确保最后一条消息完全可见
    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          // 使用setTimeout确保DOM完全更新后再滚动
          setTimeout(() => {
            // 直接滚动到底部
            messagesContainer.value.scrollTop =
              messagesContainer.value.scrollHeight;

            // 再次滚动以确保完全到底部（处理可能的图片加载延迟）
            setTimeout(() => {
              messagesContainer.value.scrollTop =
                messagesContainer.value.scrollHeight;

              // 第三次滚动，确保在所有内容加载后仍然滚动到底部
              setTimeout(() => {
                messagesContainer.value.scrollTop =
                  messagesContainer.value.scrollHeight;
              }, 300);
            }, 100);
          }, 10);
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
          enableThinking: enableThinking.value,
        });

        // 确保消息发送后滚动到底部
        scrollToBottom();
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
      isThinkingModelSupported,
      enableThinking,
      toggleThinkingMode,
    };
  },
};
</script>

<style scoped>
/* 自定义滚动条 - ChatGPT风格 */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background-color: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 9999px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.2);
}

/* 文本区域样式 - 优化版 */
textarea {
  min-height: 24px;
  max-height: 200px;
  line-height: 1.5;
  font-size: 1rem;
  outline: none !important;
  box-shadow: none !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif;
  color: #333;
  transition: all 0.2s ease;
  overflow-x: hidden !important; /* 防止水平滚动条 */
  scrollbar-width: thin; /* Firefox */
}

/* Webkit浏览器的滚动条样式 */
textarea::-webkit-scrollbar {
  width: 4px;
}

textarea::-webkit-scrollbar-track {
  background-color: transparent;
}

textarea::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 9999px;
}

textarea:focus {
  outline: none !important;
  box-shadow: none !important;
}

textarea::placeholder {
  color: #8e8ea0;
  opacity: 1;
}

/* 固定底部输入区域样式 - 简化版 */
.fixed.bottom-4 {
  transform: translateY(0); /* 防止输入区域往下滑 */
}

/* 输入区域圆角矩形样式 */
form > div.rounded-xl {
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

form > div.rounded-xl:focus-within {
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  border-color: #d1d5db;
}

/* 消息气泡样式 - ChatGPT风格 */
.message-bubble {
  border-radius: 0.75rem;
  overflow: hidden;
  transition: all 0.2s ease;
}

/* 用户消息气泡 */
.user-message {
  background-color: #2563eb;
  color: white;
  border: none;
}

/* AI消息气泡 */
.ai-message {
  background-color: #f7f7f8;
  border: none;
}

/* 工具栏按钮样式 - ChatGPT风格 */
.toolbar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.25rem;
  color: #6b7280;
  transition: all 0.2s ease;
  background-color: transparent;
  border: none;
}

.toolbar-button:hover {
  color: #4b5563;
  background-color: #f3f4f6;
}

/* 发送按钮动画 */
.animate-send-pulse {
  animation: sendPulse 0.3s ease;
}

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

/* 消息加载动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-fade-in {
  animation: fadeIn 0.3s ease forwards;
}

/* 移除不必要的边框 */
.border-t,
.border-b,
.border-r,
.border-l {
  border: none !important;
}

/* 模型选择器样式 */
.py-3 .rounded-lg {
  transition: all 0.2s ease;
}

.py-3 .rounded-lg:hover {
  background-color: #f3f4f6;
}
</style>
