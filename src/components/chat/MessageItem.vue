<template>
  <div
    :class="[
      'mb-1 flex relative group',
      message.role === 'user' ? 'justify-end' : 'justify-start',
      message.isError ? 'opacity-70' : '',
      shouldAnimate ? 'animate-message-appear' : '',
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
          'px-2.5 py-1 relative transform transition-all duration-200 flex items-center justify-center',
          message.role === 'user'
            ? 'bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-tr-sm shadow-sm'
            : 'bg-gray-50 text-gray-800 rounded-2xl rounded-tl-sm shadow-sm',
          message.isLoading ? 'animate-pulse' : '',
        ]"
      >
        <!-- 用户头像（右侧） -->
        <div
          v-if="message.role === 'user'"
          class="absolute -right-12 top-1 flex-shrink-0"
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
          class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out z-10"
        >
          <button
            @click="copyMessage"
            class="p-1 rounded-full hover:bg-gray-200 focus:outline-none transform transition-transform duration-200 hover:scale-110 active:scale-95 text-gray-400 hover:text-gray-700"
            title="复制消息"
          >
            <svg
              class="h-3.5 w-3.5"
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
        <div
          v-if="message.isLoading"
          class="flex items-center justify-center space-x-1 w-full"
        >
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
        <div v-else class="w-full flex items-center justify-center">
          <div
            v-if="message.isError"
            class="text-red-500 flex items-center justify-center w-full"
          >
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
          <div
            v-else
            class="whitespace-pre-wrap leading-tight markdown-content flex-1 self-center"
          >
            <TypewriterText
              v-if="message.role === 'assistant' && !isTyped"
              :text="message.content"
              :speed="5"
              :startDelay="50"
              :skipAnimation="!shouldAnimate"
              @typed="isTyped = true"
            />
            <div v-else v-html="formattedContent"></div>
          </div>
        </div>

        <!-- 不再显示底部信息和操作菜单 -->
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from "vue";
import { useStore } from "vuex";
import DOMPurify from "dompurify";
import { marked } from "marked";
import TypewriterText from "./TypewriterText.vue";

// 全局集合来跟踪已经显示过的消息
const displayedMessages = new Set();

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
    const store = useStore();
    // 本地状态，用于跟踪打字状态和动画状态
    const isTyped = ref(false);
    const shouldAnimate = ref(false);

    // 检查这是否是新消息
    onMounted(() => {
      // 如果消息有ID并且之前没有显示过，则这是一个新消息
      if (props.message.id && !displayedMessages.has(props.message.id)) {
        // 检查这是否是最新的消息
        const messages = store.getters["chat/getMessages"];
        const isLatestMessage =
          messages.length > 0 &&
          messages[messages.length - 1].id === props.message.id;

        // 只有最新的助手回复才显示动画
        if (isLatestMessage && props.message.role === "assistant") {
          shouldAnimate.value = true;

          // 动画结束后标记消息为已显示
          setTimeout(() => {
            displayedMessages.add(props.message.id);
            shouldAnimate.value = false;
          }, 500);
        } else {
          // 非最新消息直接标记为已显示
          displayedMessages.add(props.message.id);
        }
      }
    });
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
      shouldAnimate,
    };
  },
};
</script>

<style scoped>
/* 添加样式以支持Markdown渲染 */
:deep(pre) {
  @apply bg-gray-100 p-1 rounded my-0.5 overflow-x-auto;
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
  @apply pl-4 my-0.5;
}

:deep(ul) {
  @apply list-disc;
}

:deep(ol) {
  @apply list-decimal;
}

:deep(blockquote) {
  @apply border-l-2 border-gray-300 pl-2 italic my-0.5;
}

:deep(table) {
  @apply border-collapse border border-gray-300 my-0.5 text-sm;
}

:deep(th),
:deep(td) {
  @apply border border-gray-300 px-1 py-0.5;
}

:deep(th) {
  @apply bg-gray-100;
}
/* Markdown内容的紧凑样式 */
.markdown-content :deep(p) {
  margin-top: 0.5rem;
  margin-bottom: -1rem;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin-top: 0.25rem;
  margin-bottom: 0.125rem;
  font-weight: 600;
}

.markdown-content :deep(h1) {
  font-size: 1.25rem;
}
.markdown-content :deep(h2) {
  font-size: 1.15rem;
}
.markdown-content :deep(h3) {
  font-size: 1.05rem;
}
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  font-size: 1rem;
}

/* 使列表更加紧凑 */
.markdown-content :deep(li) {
  margin-top: 0.125rem;
  margin-bottom: 0.125rem;
}

/* 调整代码块内的文本大小 */
.markdown-content :deep(pre) {
  font-size: 0.875rem;
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
  animation-iteration-count: 1; /* 确保动画只播放一次 */
  animation-fill-mode: forwards; /* 保持动画结束时的状态 */
}
</style>
