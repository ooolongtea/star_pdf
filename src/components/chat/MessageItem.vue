<template>
  <div
    :class="[
      'py-4 px-4 md:px-8 relative group border-b border-gray-100',
      message.role === 'user' ? 'bg-white' : 'bg-gray-50',
      message.isError ? 'opacity-70' : '',
      shouldAnimate ? 'animate-message-appear' : '',
    ]"
  >
    <div
      class="w-full max-w-3xl mx-auto flex"
      :class="{ 'flex-row-reverse': message.role === 'user' }"
    >
      <!-- 头像 -->
      <div
        class="flex-shrink-0"
        :class="{
          'ml-4': message.role === 'user',
          'mr-4': message.role !== 'user',
        }"
      >
        <!-- 用户头像 -->
        <div
          v-if="message.role === 'user'"
          class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white"
        >
          <span class="text-sm font-medium">{{ userInitial }}</span>
        </div>

        <!-- AI头像 -->
        <div
          v-else
          class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 overflow-hidden"
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

      <!-- 消息内容 -->
      <div class="flex-1 min-w-0 relative">
        <!-- 复制按钮 -->
        <div
          v-if="
            !message.isLoading &&
            !message.isError &&
            message.role === 'assistant'
          "
          class="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          <button
            @click="copyMessage"
            class="p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
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

        <!-- 消息内容 - ChatGPT风格 -->
        <div v-if="message.isLoading" class="flex items-center py-2">
          <div class="flex space-x-1">
            <div
              class="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
              style="animation-delay: 0s"
            ></div>
            <div
              class="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
              style="animation-delay: 0.1s"
            ></div>
            <div
              class="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
              style="animation-delay: 0.2s"
            ></div>
          </div>
        </div>
        <div v-else>
          <div v-if="message.isError" class="text-red-500 flex items-center">
            <svg
              class="inline-block h-4 w-4 mr-2 flex-shrink-0"
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
            class="whitespace-pre-wrap leading-relaxed markdown-content"
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

            <!-- 思考链（如果有） -->
            <ThoughtChain
              v-if="message.role === 'assistant' && thoughtChain"
              :thoughtChain="thoughtChain"
            />

            <!-- 文本内容 -->
            <TypewriterText
              v-if="message.role === 'assistant' && !isTyped"
              :text="actualContent"
              :speed="5"
              :startDelay="50"
              :skipAnimation="!shouldAnimate"
              @typed="isTyped = true"
            />
            <!-- 用户消息 -->
            <div
              v-else-if="message.role === 'user'"
              class="user-message-content"
            >
              <div v-html="renderMarkdown(actualContent)"></div>
            </div>
            <!-- AI消息 -->
            <div v-else class="message-markdown" style="display: inline-block">
              <div v-html="renderMarkdown(actualContent)"></div>
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
import ThoughtChain from "./ThoughtChain.vue";
import { marked } from "marked";
import DOMPurify from "dompurify";

// 全局集合来跟踪已经显示过的消息
const displayedMessages = new Set();

export default {
  name: "MessageItem",
  components: {
    TypewriterText,
    ThoughtChain,
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

    // 提取思考链和实际内容
    const thoughtChain = ref("");
    const actualContent = ref("");

    // 解析消息内容，提取思考链
    if (props.message.role === "assistant" && props.message.content) {
      const content = props.message.content;
      const thoughtMatch = content.match(/<thought>([\s\S]*?)<\/thought>/);

      if (thoughtMatch && thoughtMatch[1]) {
        thoughtChain.value = thoughtMatch[1].trim();
        actualContent.value = content
          .replace(/<thought>[\s\S]*?<\/thought>\s*/, "")
          .trim();
      } else {
        actualContent.value = content;
      }
    } else {
      actualContent.value = props.message.content || "";
    }

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

    // 监听消息变化，重置打字状态并重新解析思考链
    watch(
      () => props.message.content,
      (newContent) => {
        if (props.message.role === "assistant") {
          isTyped.value = false;

          // 重新解析思考链
          if (newContent) {
            const thoughtMatch = newContent.match(
              /<thought>([\s\S]*?)<\/thought>/
            );

            if (thoughtMatch && thoughtMatch[1]) {
              thoughtChain.value = thoughtMatch[1].trim();
              actualContent.value = newContent
                .replace(/<thought>[\s\S]*?<\/thought>\s*/, "")
                .trim();
            } else {
              thoughtChain.value = "";
              actualContent.value = newContent;
            }
          } else {
            thoughtChain.value = "";
            actualContent.value = "";
          }
        }
      }
    );

    // 渲染Markdown内容
    const renderMarkdown = (content) => {
      if (!content) return "";

      // 配置marked选项
      marked.setOptions({
        // eslint-disable-next-line no-unused-vars
        highlight: function (code, lang) {
          // 这里可以集成语法高亮库，如Prism或Highlight.js
          // 这里我们只是简单地返回代码，并在后续处理中添加语言标记
          return code;
        },
        langPrefix: "language-",
        gfm: true,
        breaks: true,
      });

      // 使用marked解析Markdown
      const rawHtml = marked(content);

      // 使用DOMPurify清理HTML，防止XSS攻击
      const cleanHtml = DOMPurify.sanitize(rawHtml);

      // 在下一个tick中添加复制按钮到代码块和语言标签
      setTimeout(() => {
        addCopyButtonsToCodeBlocks();
        addLanguageLabelsToCodeBlocks();
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

    // 为代码块添加语言标签
    const addLanguageLabelsToCodeBlocks = () => {
      // 查找所有代码块
      const codeBlocks = document.querySelectorAll(".message-markdown pre");

      codeBlocks.forEach((block) => {
        // 查找代码元素
        const code = block.querySelector("code");
        if (!code) return;

        // 获取语言类名
        const classes = code.className.split(" ");
        let language = "";

        // 查找语言类名（格式为 language-xxx）
        for (const cls of classes) {
          if (cls.startsWith("language-")) {
            language = cls.replace("language-", "");
            break;
          }
        }

        // 如果找到了语言，添加到pre元素的data-language属性
        if (language && language !== "plaintext" && language !== "text") {
          block.setAttribute("data-language", language);
        } else {
          block.setAttribute("data-language", "代码");
        }
      });
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
      thoughtChain,
      actualContent,
    };
  },
};
</script>

<style scoped>
/* 消息气泡样式 - 优雅的极简主义设计 */
.message-bubble {
  border-radius: 1.5rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  max-width: 100%;
  position: relative;
  line-height: 1.3;
  padding: 0.5rem 0.75rem !important; /* 更紧凑的内边距 */
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  backdrop-filter: blur(10px);
  letter-spacing: 0.01em;
}

.user-message {
  background: linear-gradient(
    135deg,
    #4f46e5 0%,
    #3b82f6 100%
  ); /* 优雅的渐变蓝 */
  color: white;
  border-top-right-radius: 0.5rem;
  border-bottom-right-radius: 1.25rem;
  margin-right: 0.5rem;
}

.ai-message {
  background: linear-gradient(
    135deg,
    #f8fafc 0%,
    #f1f5f9 100%
  ); /* 柔和的渐变灰 */
  color: #1e293b;
  border-top-left-radius: 0.5rem;
  border-bottom-left-radius: 1.25rem;
  border: 1px solid rgba(226, 232, 240, 0.8);
}

/* 添加样式以支持Markdown渲染 - 更现代化的设计 */
:deep(pre) {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 1.25rem;
  border-radius: 0.75rem;
  margin: 0.75rem 0;
  overflow-x: auto;
  border: 1px solid rgba(226, 232, 240, 0.8);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  position: relative;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

:deep(code) {
  background-color: rgba(243, 244, 246, 0.8);
  padding: 0.125rem 0.375rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  color: #4f46e5;
  transition: all 0.2s ease;
}

.user-message :deep(code) {
  background-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

:deep(pre code) {
  background-color: transparent;
  padding: 0;
  color: #374151;
  font-size: 0.9rem;
  line-height: 1.5;
}

:deep(a) {
  color: #2563eb;
  text-decoration: none;
  border-bottom: 1px solid #93c5fd;
  transition: all 0.2s ease;
  padding-bottom: 1px;
}

.user-message :deep(a) {
  color: #ffffff;
  border-bottom-color: rgba(255, 255, 255, 0.5);
}

:deep(a:hover) {
  color: #1d4ed8;
  border-bottom-color: #2563eb;
  border-bottom-width: 2px;
}

.user-message :deep(a:hover) {
  color: #ffffff;
  border-bottom-color: #ffffff;
}

:deep(ul),
:deep(ol) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}

:deep(ul) {
  list-style-type: disc;
}

:deep(ol) {
  list-style-type: decimal;
}

:deep(li) {
  margin-bottom: 0.25rem;
  padding-left: 0.25rem;
}

/* 嵌套列表的间距更小 */
:deep(li) :deep(ul),
:deep(li) :deep(ol) {
  margin: 0.25rem 0;
}

:deep(blockquote) {
  border-left: 4px solid #6366f1;
  padding: 0.75rem 1.25rem;
  color: #4b5563;
  font-style: italic;
  margin: 0.75rem 0;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  position: relative;
  letter-spacing: 0.01em;
  line-height: 1.6;
}

.user-message :deep(blockquote) {
  border-left-color: rgba(255, 255, 255, 0.8);
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15) 0%,
    rgba(255, 255, 255, 0.05) 100%
  );
  color: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

:deep(table) {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  margin: 1rem 0;
  font-size: 0.875rem;
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

:deep(th),
:deep(td) {
  border: 1px solid rgba(226, 232, 240, 0.8);
  padding: 0.75rem 1rem;
  text-align: left;
}

:deep(th) {
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  font-weight: 600;
  color: #334155;
  letter-spacing: 0.025em;
}

:deep(tr:nth-child(even)) {
  background-color: rgba(248, 250, 252, 0.7);
}

:deep(tr:hover) {
  background-color: rgba(241, 245, 249, 0.9);
}

/* Markdown内容样式 - ChatGPT风格 */
.message-markdown {
  max-width: 100%;
  font-size: 1rem;
  line-height: 1.5;
  color: inherit;
}

/* 段落间距 */
.message-markdown :deep(p) {
  margin: 0.5rem 0;
}

/* 用户消息内容 */
.user-message-content {
  display: inline-block;
  max-width: 90%;
  margin-left: auto; /* 将用户消息移到右侧 */
  text-align: right; /* 文本右对齐 */
}

/* 用户消息内的段落间距 */
.user-message-content :deep(p) {
  margin: 0.25rem 0;
}

.user-message-content :deep(p:first-child) {
  margin-top: 0;
}

.user-message-content :deep(p:last-child) {
  margin-bottom: 0;
}

/* 标题样式 */
.message-markdown :deep(h1),
.message-markdown :deep(h2),
.message-markdown :deep(h3),
.message-markdown :deep(h4),
.message-markdown :deep(h5),
.message-markdown :deep(h6) {
  margin: 1rem 0 0.5rem 0;
  font-weight: 600;
  line-height: 1.3;
  color: inherit;
}

.message-markdown :deep(h1) {
  font-size: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.25rem;
}

.message-markdown :deep(h2) {
  font-size: 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.25rem;
}

.message-markdown :deep(h3) {
  font-size: 1.125rem;
}

.message-markdown :deep(h4),
.message-markdown :deep(h5),
.message-markdown :deep(h6) {
  font-size: 1rem;
}

/* 代码块样式 */
.message-markdown :deep(pre) {
  position: relative;
  background-color: #f7f7f8;
  border-radius: 0.375rem;
  padding: 1rem;
  margin: 0.75rem 0;
  overflow-x: auto;
}

/* 代码块语言标签 */
.message-markdown :deep(pre)::before {
  content: attr(data-language);
  position: absolute;
  top: 0;
  right: 0;
  padding: 0.25rem 0.5rem;
  font-size: 0.7rem;
  background-color: #f0f0f0;
  color: #666;
  border-bottom-left-radius: 0.25rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif;
  font-weight: 500;
  text-transform: uppercase;
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

/* 消息出现动画 - ChatGPT风格，更平滑的动画效果 */
@keyframes messageAppear {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-message-appear {
  animation: messageAppear 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* 代码块复制按钮样式 - ChatGPT风格 */
.code-copy-button {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background-color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.25rem;
  padding: 0.25rem;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
  font-size: 0.75rem;
  z-index: 10;
  color: #666;
}

pre:hover .code-copy-button {
  opacity: 1;
}

.code-copy-button:hover {
  background-color: rgba(255, 255, 255, 1);
  color: #333;
}

/* 复制成功提示样式 - ChatGPT风格 */
.copy-success-tooltip {
  position: absolute;
  top: -2rem;
  right: 0;
  background-color: #333;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  white-space: nowrap;
  animation: fadeInOut 2s ease;
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

/* 全局复制通知样式 - ChatGPT风格 */
.copy-notification {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%) translateY(-20px);
  background-color: #333;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  z-index: 9999;
  opacity: 0;
  transition: all 0.3s ease;
}

.copy-notification.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
