<template>
  <div
    :class="[
      'mb-4 flex relative group animate-message-appear',
      message.role === 'user' ? 'justify-end' : 'justify-start',
      message.isError ? 'opacity-70' : '',
    ]"
  >
    <div class="flex items-start" style="max-width: 85%">
      <!-- 用户/AI头像 -->
      <div v-if="message.role === 'assistant'" class="flex-shrink-0 mr-2 mt-1">
        <div
          class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"
        >
          <svg
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
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            ></path>
          </svg>
        </div>
      </div>
      <div
        :class="[
          'px-4 py-3 relative transform transition-all duration-200',
          message.role === 'user'
            ? 'bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-tr-sm shadow-sm'
            : 'bg-gray-50 text-gray-800 rounded-2xl rounded-tl-sm shadow-sm',
          message.isLoading ? 'animate-pulse' : '',
        ]"
      >
        <!-- 用户头像（右侧） -->
        <div
          v-if="message.role === 'user'"
          class="absolute -right-10 top-0 flex-shrink-0"
        >
          <div
            class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white"
          >
            <span class="text-sm font-medium">U</span>
          </div>
        </div>
        <!-- 复制按钮（悬停时显示） -->
        <div
          v-if="!message.isLoading && !message.isError"
          class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out z-10"
        >
          <button
            @click="copyMessage"
            class="p-1.5 rounded-full hover:bg-gray-200 focus:outline-none transform transition-transform duration-200 hover:scale-110 active:scale-95 text-gray-400 hover:text-gray-700"
            title="复制消息"
          >
            <svg
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
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              ></path>
            </svg>
          </button>
        </div>

        <!-- 消息内容 -->
        <div v-if="message.isLoading" class="flex items-center space-x-1">
          <div
            class="h-2.5 w-2.5 bg-gray-400 rounded-full animate-bounce"
            style="animation-delay: 0ms"
          ></div>
          <div
            class="h-2.5 w-2.5 bg-gray-400 rounded-full animate-bounce"
            style="animation-delay: 150ms"
          ></div>
          <div
            class="h-2.5 w-2.5 bg-gray-400 rounded-full animate-bounce"
            style="animation-delay: 300ms"
          ></div>
        </div>
        <div v-else>
          <div v-if="message.isError" class="text-red-500 flex items-start">
            <svg
              class="inline-block h-5 w-5 mr-1.5 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              ></path>
            </svg>
            {{ message.content }}
          </div>
          <div v-else class="whitespace-pre-wrap leading-relaxed">
            <TypewriterText
              v-if="message.role === 'assistant' && !isTyped"
              :text="message.content"
              :speed="20"
              @typed="isTyped = true"
            />
            <div v-else v-html="formattedContent"></div>
          </div>
        </div>

        <!-- 消息底部信息和操作菜单 -->
        <div
          v-if="!message.isLoading"
          class="flex justify-between items-center mt-2"
        >
          <span class="text-xs text-gray-500 opacity-70">
            {{ formatTime(message.created_at) }}
          </span>

          <!-- 消息操作菜单 -->
          <div
            class="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out"
          >
            <button
              v-if="message.role === 'assistant'"
              @click="copyMessage"
              class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors duration-200 transform hover:scale-105 active:scale-95"
              title="复制"
            >
              复制
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from "vue";
import DOMPurify from "dompurify";
import { marked } from "marked";
import TypewriterText from "./TypewriterText.vue";

export default {
  name: "MessageItem",
  components: {
    TypewriterText,
  },
  props: {
    message: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    // 本地状态，用于跟踪打字状态
    const isTyped = ref(false);
    // 格式化消息内容，支持Markdown
    const formattedContent = computed(() => {
      if (!props.message.content) return "";

      // 使用marked解析Markdown
      const rawHtml = marked(props.message.content);

      // 使用DOMPurify清理HTML，防止XSS攻击
      return DOMPurify.sanitize(rawHtml);
    });

    // 格式化时间
    const formatTime = (timestamp) => {
      if (!timestamp) return "";

      const date = new Date(timestamp);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    // 复制消息
    const copyMessage = () => {
      const textToCopy = props.message.content || "";
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          showCopiedNotification();
        })
        .catch((err) => {
          console.error("复制失败:", err);
        });
    };

    // 显示复制成功通知
    const showCopiedNotification = () => {
      // 这里可以集成一个通知组件或使用全局通知系统
      // 例如，如果有全局状态管理，可以调用如下代码：
      // store.dispatch('setNotification', { type: 'success', message: '已复制到剪贴板' });
      alert("已复制到剪贴板");
    };

    // 监听消息变化，重置打字状态
    watch(
      () => props.message.content,
      () => {
        if (props.message.role === "assistant") {
          isTyped.value = false;
        }
      }
    );

    return {
      formattedContent,
      formatTime,
      copyMessage,
      isTyped,
    };
  },
};
</script>

<style scoped>
/* 添加样式以支持Markdown渲染 */
:deep(pre) {
  @apply bg-gray-100 p-2 rounded my-2 overflow-x-auto;
}

:deep(code) {
  @apply bg-gray-100 px-1 py-0.5 rounded text-sm;
}

:deep(pre code) {
  @apply bg-transparent p-0;
}

:deep(a) {
  @apply text-blue-600 hover:underline;
}

:deep(ul),
:deep(ol) {
  @apply pl-5 my-2;
}

:deep(ul) {
  @apply list-disc;
}

:deep(ol) {
  @apply list-decimal;
}

:deep(blockquote) {
  @apply border-l-4 border-gray-300 pl-4 italic my-2;
}

:deep(table) {
  @apply border-collapse border border-gray-300 my-2;
}

:deep(th),
:deep(td) {
  @apply border border-gray-300 px-2 py-1;
}

:deep(th) {
  @apply bg-gray-100;
}
</style>

<style>
/* 添加悬停效果 */
.group:hover .group-hover\:opacity-100 {
  opacity: 1;
}

/* 添加过渡效果 */
.transition-opacity {
  transition-property: opacity;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

.transition-colors {
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* 消息出现动画 */
@keyframes messageAppear {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-message-appear {
  animation: messageAppear 0.3s ease-out forwards;
}
</style>
