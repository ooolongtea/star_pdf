<template>
  <div
    :class="[
      'mb-1 flex relative group',
      message.role === 'user' ? 'justify-end ' : 'justify-start',
      message.isError ? 'opacity-70' : '',
      shouldAnimate ? 'animate-message-appear' : '',
    ]"
  >
    <!-- 用户头像（右侧） - 独立于气泡 -->
    <div
      v-if="message.role === 'user'"
      class="absolute right-0 top-1 flex-shrink-0 z-0"
    >
      <div
        class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white"
      >
        <span class="text-sm font-medium">{{ userInitial }}</span>
      </div>
    </div>

    <div class="flex items-start" style="max-width: 85%">
      <!-- AI头像 -->
      <div v-if="message.role === 'assistant'" class="flex-shrink-0 mr-2 mt-1">
        <div
          class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 overflow-hidden"
        >
          <!-- 根据当前模型显示不同的头像 -->
          <img
            v-if="modelLogo"
            :src="modelLogo"
            :alt="currentModel?.provider || 'AI'"
            class="w-6 h-6 object-contain"
            @error="handleImageError"
          />
          <!-- 默认AI图标 -->
          <svg
            v-else
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
          'px-3 py-2 relative transform transition-all duration-200 flex items-center justify-center message-bubble',
          message.role === 'user' ? 'user-message mr-10' : 'ai-message',
          message.isLoading ? 'animate-pulse' : '',
        ]"
      >
        <!-- 复制按钮（悬停时显示） - 更现代的设计 -->
        <div
          v-if="!message.isLoading && !message.isError"
          class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out z-10"
        >
          <button
            @click="copyMessage"
            class="p-1.5 rounded-md bg-white/80 backdrop-blur-sm shadow-sm hover:bg-gray-100 focus:outline-none transform transition-all duration-200 hover:scale-105 active:scale-95 text-gray-500 hover:text-gray-700 border border-gray-200"
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

        <!-- 消息内容 - 更现代的加载动画 -->
        <div
          v-if="message.isLoading"
          class="flex items-center justify-center space-x-1.5 w-full py-1"
        >
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
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
            <!-- 用户消息中的图片 -->
            <div v-if="message.role === 'user' && message.image" class="mb-2">
              <img
                :src="message.image"
                alt="用户上传图片"
                class="max-h-60 max-w-full rounded-md object-contain"
                @click="showFullImage(message.image)"
              />
            </div>

            <!-- 文本内容 -->
            <TypewriterText
              v-if="message.role === 'assistant' && !isTyped"
              :text="message.content"
              :speed="5"
              :startDelay="50"
              :skipAnimation="!shouldAnimate"
              @typed="isTyped = true"
            />
            <div v-else class="message-markdown">
              <div v-html="renderMarkdown(message.content)"></div>
            </div>

            <!-- AI回复中的图片 -->
            <div
              v-if="
                message.role === 'assistant' &&
                message.images &&
                message.images.length > 0
              "
              class="mt-2 flex flex-wrap gap-2"
            >
              <div
                v-for="(img, index) in message.images"
                :key="index"
                class="relative border rounded-md overflow-hidden"
              >
                <img
                  :src="img"
                  alt="AI生成图片"
                  class="max-h-60 max-w-full object-contain cursor-pointer"
                  @click="showFullImage(img)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted } from "vue";
import { useStore } from "vuex";
import TypewriterText from "./TypewriterText.vue";
import { marked } from "marked";
import DOMPurify from "dompurify";

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

    // 获取当前用户信息
    const user = store.getters["auth/getUser"];

    // 获取用户首字母
    const userInitial = ref("");
    if (user && user.username) {
      // 提取用户名的首字母（支持中英文）
      const username = user.username;
      if (username) {
        // 检查是否是中文字符
        if (/^[\u4e00-\u9fa5]/.test(username)) {
          userInitial.value = username.charAt(0);
        } else {
          userInitial.value = username.charAt(0).toUpperCase();
        }
      } else {
        userInitial.value = "U";
      }
    } else {
      userInitial.value = "U";
    }

    // 获取当前对话使用的模型
    const currentModel = ref(null);
    const modelLogo = ref("");

    // 尝试从消息中获取模型信息
    if (props.message && props.message.model) {
      currentModel.value = props.message.model;
      // 根据模型提供商设置Logo
      setModelLogo(props.message.model.provider);
    } else {
      // 从当前会话获取模型信息
      const currentConversation = store.getters["chat/getCurrentConversation"];

      if (currentConversation) {
        // 检查是否有model属性
        if (currentConversation.model) {
          currentModel.value = currentConversation.model;
          // 根据模型提供商设置Logo
          setModelLogo(currentConversation.model.provider);
        }
        // 检查是否有model_name属性
        else if (currentConversation.model_name) {
          // 从model_name中提取提供商信息
          const modelNameParts = currentConversation.model_name.split(":");
          if (modelNameParts.length > 0) {
            const provider = modelNameParts[0];

            // 创建一个模型对象
            currentModel.value = {
              provider: provider,
              name: modelNameParts.length > 1 ? modelNameParts[1] : "",
              fullName: currentConversation.model_name,
            };

            // 根据提供商设置Logo
            setModelLogo(provider);
          }
        }
      }
    }

    // 根据提供商设置模型Logo
    function setModelLogo(provider) {
      if (!provider) return;

      const providerLowerCase = provider.toLowerCase();

      // 设置不同厂商的Logo路径
      if (providerLowerCase.includes("qwen")) {
        modelLogo.value = "/images/ai-logos/qwen.png";
      } else if (providerLowerCase.includes("deepseek")) {
        modelLogo.value = "/images/ai-logos/deepseek.png";
      } else if (providerLowerCase.includes("openai")) {
        modelLogo.value = "/images/ai-logos/openai.png";
      } else if (
        providerLowerCase.includes("baidu") ||
        providerLowerCase.includes("ernie")
      ) {
        // 如果没有ernie.png，使用默认图标
        modelLogo.value = "";
      } else if (
        providerLowerCase.includes("zhipu") ||
        providerLowerCase.includes("chatglm")
      ) {
        // 如果没有zhipu.png，使用默认图标
        modelLogo.value = "";
      } else {
        modelLogo.value = ""; // 使用默认SVG图标
      }
    }

    // 处理图片加载错误
    const handleImageError = () => {
      // 图片加载失败时，清空modelLogo，显示默认SVG图标
      modelLogo.value = "";
    };

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
      // 创建一个临时提示元素
      const notification = document.createElement("div");
      notification.className = "copy-notification";
      notification.textContent = "已复制到剪贴板";

      // 添加到文档中
      document.body.appendChild(notification);

      // 添加显示动画
      setTimeout(() => {
        notification.classList.add("show");
      }, 10);

      // 2秒后移除
      setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300); // 等待淡出动画完成
      }, 2000);
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

    // 渲染Markdown内容
    const renderMarkdown = (content) => {
      if (!content) return "";

      // 使用marked解析Markdown
      const rawHtml = marked(content);

      // 使用DOMPurify清理HTML，防止XSS攻击
      const cleanHtml = DOMPurify.sanitize(rawHtml);

      // 在下一个tick中添加复制按钮到代码块
      setTimeout(() => {
        addCopyButtonsToCodeBlocks();
      }, 0);

      return cleanHtml;
    };

    // 为代码块添加复制按钮
    const addCopyButtonsToCodeBlocks = () => {
      // 查找所有代码块
      const codeBlocks = document.querySelectorAll(".message-markdown pre");

      codeBlocks.forEach((block) => {
        // 如果已经有复制按钮，则跳过
        if (block.querySelector(".code-copy-button")) return;

        // 创建复制按钮
        const copyButton = document.createElement("button");
        copyButton.className = "code-copy-button";
        copyButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        `;

        // 添加点击事件
        copyButton.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          // 获取代码内容
          const code = block.querySelector("code");
          if (!code) return;

          // 复制到剪贴板
          navigator.clipboard
            .writeText(code.textContent)
            .then(() => {
              // 显示成功提示
              showCopySuccess(copyButton);
            })
            .catch((err) => {
              console.error("复制失败:", err);
            });
        });

        // 添加按钮到代码块
        block.style.position = "relative";
        block.appendChild(copyButton);
      });
    };

    // 显示复制成功提示
    const showCopySuccess = (button) => {
      // 创建提示元素
      const tooltip = document.createElement("div");
      tooltip.className = "copy-success-tooltip";
      tooltip.textContent = "已复制";

      // 添加到按钮旁边
      button.appendChild(tooltip);

      // 2秒后移除提示
      setTimeout(() => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      }, 2000);
    };

    // 显示全屏图片
    const showFullImage = (imageSrc) => {
      if (!imageSrc) return;

      // 创建全屏图片查看器
      const viewer = document.createElement("div");
      viewer.className =
        "fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50";
      viewer.style.backdropFilter = "blur(5px)";

      // 创建图片元素
      const img = document.createElement("img");
      img.src = imageSrc;
      img.className = "max-h-[90vh] max-w-[90vw] object-contain";

      // 创建关闭按钮
      const closeBtn = document.createElement("button");
      closeBtn.className =
        "absolute top-4 right-4 text-white bg-gray-800 rounded-full p-2 hover:bg-gray-700";
      closeBtn.innerHTML = `
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      `;

      // 添加点击事件
      closeBtn.addEventListener("click", () => {
        document.body.removeChild(viewer);
      });

      // 点击背景关闭
      viewer.addEventListener("click", (e) => {
        if (e.target === viewer) {
          document.body.removeChild(viewer);
        }
      });

      // 添加到DOM
      viewer.appendChild(img);
      viewer.appendChild(closeBtn);
      document.body.appendChild(viewer);
    };

    return {
      formatTime,
      copyMessage,
      isTyped,
      shouldAnimate,
      renderMarkdown,
      userInitial,
      currentModel,
      modelLogo,
      handleImageError,
      showFullImage,
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
/* v-md-editor 样式调整 */
.message-markdown {
  max-width: 100%;
  font-size: 0.95rem;
}

/* 移除v-md-editor默认边框和背景 */
.message-markdown :deep(.v-md-editor) {
  border: none !important;
  background-color: transparent !important;
  box-shadow: none !important;
}

/* 移除v-md-editor默认内边距 */
.message-markdown :deep(.v-md-editor__preview) {
  padding: 0 !important;
  margin: 0 !important;
}

/* 调整段落间距 */
.message-markdown :deep(p) {
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
}

/* 调整标题样式 */
.message-markdown :deep(h1),
.message-markdown :deep(h2),
.message-markdown :deep(h3),
.message-markdown :deep(h4),
.message-markdown :deep(h5),
.message-markdown :deep(h6) {
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
  font-weight: 600;
}

.message-markdown :deep(h1) {
  font-size: 1.25rem;
}
.message-markdown :deep(h2) {
  font-size: 1.15rem;
}
.message-markdown :deep(h3) {
  font-size: 1.05rem;
}
.message-markdown :deep(h4),
.message-markdown :deep(h5),
.message-markdown :deep(h6) {
  font-size: 1rem;
}

/* 使列表更加紧凑 */
.message-markdown :deep(li) {
  margin-top: 0.125rem;
  margin-bottom: 0.125rem;
}

/* 调整代码块样式 */
.message-markdown :deep(pre) {
  font-size: 0.875rem;
  margin: 0.5rem 0;
  border-radius: 4px;
  background-color: #f3f4f6; /* 更明显的背景色 */
  border: 1px solid #e5e7eb;
}

/* 调整表格样式 */
.message-markdown :deep(table) {
  font-size: 0.875rem;
  margin: 0.5rem 0;
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

/* 代码块复制按钮样式 */
.code-copy-button {
  position: absolute;
  top: 2px;
  right: 2px;
  background-color: rgba(255, 255, 255, 0.8);
  border: 1px solid #e2e8f0;
  border-radius: 2px;
  padding: 0px;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 8px;
}

pre:hover .code-copy-button {
  opacity: 1;
}

.code-copy-button:hover {
  background-color: #f1f5f9;
}

/* 复制成功提示样式 */
.copy-success-tooltip {
  position: absolute;
  top: -20px;
  right: 0;
  background-color: #4b5563;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
}

/* 全局复制通知样式 */
.copy-notification {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%) translateY(-20px);
  background-color: #4b5563;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  z-index: 9999;
  opacity: 0;
  transition: opacity 0.3s, transform 0.3s;
}

.copy-notification.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* 打字动画点 */
.typing-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.typing-dots span {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #a0aec0;
  animation: typingAnimation 1.4s infinite ease-in-out both;
}

.typing-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typingAnimation {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.6;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
