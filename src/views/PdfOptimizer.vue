<template>
  <div class="pdf-optimizer">
    <div class="max-w-7xl mx-auto bg-white p-6 rounded-lg shadow-md">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-800">PDF 结果优化</h1>
        <div class="flex space-x-2">
          <button
            @click="goBack"
            class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 focus:outline-none flex items-center"
          >
            <svg
              class="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              ></path>
            </svg>
            返回
          </button>
          <button
            @click="downloadOptimizedResult"
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none flex items-center"
            :disabled="!optimizedContent || isOptimizing"
          >
            <svg
              class="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              ></path>
            </svg>
            下载优化结果
          </button>
        </div>
      </div>

      <!-- 文件信息 -->
      <div
        v-if="fileInfo"
        class="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100"
      >
        <div class="flex items-center">
          <div
            class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
          </div>
          <div class="ml-4">
            <h2 class="text-lg font-semibold text-gray-800">
              {{ fileInfo.originalFilename }}
            </h2>
            <p class="text-sm text-gray-600">
              创建于 {{ formatDate(fileInfo.createdAt) }}
            </p>
          </div>
        </div>
      </div>

      <!-- 优化提示词设置 -->
      <div class="mb-6">
        <OptimizationPrompt
          v-model="optimizationPrompt"
          :disabled="isOptimizing"
          @optimize="optimizeContent"
        />
      </div>

      <!-- 加载中状态 -->
      <div v-if="isLoading || isOptimizing" class="flex justify-center py-8">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"
        ></div>
        <p class="ml-4 text-gray-600">
          {{ isLoading ? "加载内容中..." : "优化处理中..." }}
        </p>
      </div>

      <!-- 错误提示 -->
      <div
        v-else-if="error"
        class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md"
      >
        <p class="font-medium">加载失败</p>
        <p class="text-sm">{{ error }}</p>
      </div>

      <!-- 内容对比视图 -->
      <div
        v-else-if="originalContent"
        class="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <!-- 原始内容 -->
        <div class="border rounded-lg shadow-sm overflow-hidden">
          <div class="bg-gray-50 px-4 py-2 border-b">
            <h3 class="font-medium text-gray-700">原始结果</h3>
          </div>
          <div class="p-4 max-h-[70vh] overflow-auto">
            <v-md-editor
              v-model="originalContent"
              mode="preview"
              class="markdown-preview"
              :preview-theme="'github'"
              :default-show-toc="false"
              :include-level="[1, 2, 3]"
              @image-click="handleImageClick"
            ></v-md-editor>
          </div>
        </div>

        <!-- 优化后内容 -->
        <div class="border rounded-lg shadow-sm overflow-hidden">
          <div
            class="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 border-b border-blue-100"
          >
            <h3 class="font-medium text-blue-700">优化结果</h3>
          </div>
          <div class="p-4 max-h-[70vh] overflow-auto">
            <div
              v-if="!optimizedContent && !isOptimizing"
              class="flex flex-col items-center justify-center h-64"
            >
              <svg
                class="w-16 h-16 text-gray-300 mb-4"
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
              <p class="text-gray-500 text-center">
                点击"开始优化"按钮，使用AI优化内容
              </p>
            </div>
            <v-md-editor
              v-else-if="optimizedContent"
              v-model="optimizedContent"
              mode="preview"
              class="markdown-preview"
              :preview-theme="'github'"
              :default-show-toc="false"
              :include-level="[1, 2, 3]"
              @image-click="handleImageClick"
            ></v-md-editor>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import axios from "axios";
import OptimizationPrompt from "@/components/OptimizationPrompt.vue";

export default {
  name: "PdfOptimizer",
  components: {
    OptimizationPrompt,
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const store = useStore();

    // 获取文件ID
    const fileId = computed(() => route.params.id);

    // 状态变量
    const fileInfo = ref(null);
    const originalContent = ref("");
    const optimizedContent = ref("");
    const isLoading = ref(true);
    const isOptimizing = ref(false);
    const error = ref(null);
    const optimizationPrompt = ref(
      "请优化以下从PDF提取的文本内容，修复OCR错误，调整格式，使其更易阅读。保留原始信息的完整性，但提高文本的清晰度和结构性。特别注意修复化学式、数学公式和专业术语。"
    );

    // 加载文件信息和原始内容
    const loadFileContent = async () => {
      isLoading.value = true;
      error.value = null;

      try {
        // 获取文件详情
        const detailsResponse = await axios.get(
          `/api/pdf/files/${fileId.value}/results`,
          {
            headers: {
              Authorization: `Bearer ${store.getters["auth/getToken"]}`,
            },
          }
        );

        if (detailsResponse.data.success) {
          fileInfo.value = detailsResponse.data.data;

          // 获取Markdown内容
          if (fileInfo.value.markdownUrl) {
            const markdownResponse = await axios.get(
              fileInfo.value.markdownUrl
            );
            originalContent.value = markdownResponse.data;

            // 处理Markdown内容中的图片路径
            processMarkdownContent();
          }

          // 检查是否有优化过的内容
          await checkOptimizedContent();
        } else {
          error.value = detailsResponse.data.message || "加载失败";
        }
      } catch (err) {
        console.error("加载文件内容错误:", err);
        error.value = err.response?.data?.message || "加载失败，请稍后重试";
      } finally {
        isLoading.value = false;
      }
    };

    // 检查是否有优化过的内容
    const checkOptimizedContent = async () => {
      try {
        const response = await axios.get(
          `/api/pdf/files/${fileId.value}/optimized`,
          {
            headers: {
              Authorization: `Bearer ${store.getters["auth/getToken"]}`,
            },
          }
        );

        if (response.data.success && response.data.data) {
          optimizedContent.value = response.data.data;
        }
      } catch (err) {
        // 如果没有优化过的内容，不显示错误
        console.log("没有找到优化过的内容");
      }
    };

    // 处理Markdown内容中的图片路径
    const processMarkdownContent = () => {
      if (!originalContent.value || !fileInfo.value) return;

      try {
        // 修复图片路径
        let content = originalContent.value;

        // 替换Markdown格式的图片引用 - 处理images/路径
        content = content.replace(
          /!\[([^\]]*)\]\(images\/([^)]+)\)/g,
          (_, alt, imgPath) => {
            return `![${alt || "图片"}](/api/pdf/files/${
              fileInfo.value.id
            }/images/${imgPath})`;
          }
        );

        // 替换Markdown格式的图片引用 - 处理相对路径
        content = content.replace(
          /!\[([^\]]*)\]\((?!http|\/|images\/)([^)]+)\)/g,
          (_, alt, imgPath) => {
            return `![${alt || "图片"}](/api/pdf/files/${
              fileInfo.value.id
            }/images/${imgPath})`;
          }
        );

        // 替换HTML格式的图片引用 - 处理images/路径
        content = content.replace(
          /<img([^>]*)src=["']images\/([^"']+)["']([^>]*)>/g,
          (_, before, imgPath, after) => {
            return `<img${before}src="/api/pdf/files/${fileInfo.value.id}/images/${imgPath}"${after}>`;
          }
        );

        // 替换HTML格式的图片引用 - 处理相对路径
        content = content.replace(
          /<img([^>]*)src=["'](?!http|\/|images\/)([^"']+)["']([^>]*)>/g,
          (_, before, imgPath, after) => {
            return `<img${before}src="/api/pdf/files/${fileInfo.value.id}/images/${imgPath}"${after}>`;
          }
        );

        // 更新Markdown内容
        originalContent.value = content;
      } catch (err) {
        console.error("处理Markdown内容错误:", err);
      }
    };

    // 优化内容
    const optimizeContent = async () => {
      if (!originalContent.value || isOptimizing.value) return;

      isOptimizing.value = true;
      error.value = null;

      try {
        const response = await axios.post(
          `/api/pdf/files/${fileId.value}/optimize`,
          {
            prompt: optimizationPrompt.value,
          },
          {
            headers: {
              Authorization: `Bearer ${store.getters["auth/getToken"]}`,
            },
          }
        );

        if (response.data.success) {
          optimizedContent.value = response.data.data;

          // 显示成功通知
          store.dispatch("setNotification", {
            type: "success",
            message: "内容优化成功！",
          });
        } else {
          error.value = response.data.message || "优化失败";
        }
      } catch (err) {
        console.error("优化内容错误:", err);
        error.value = err.response?.data?.message || "优化失败，请稍后重试";
      } finally {
        isOptimizing.value = false;
      }
    };

    // 下载优化后的结果
    const downloadOptimizedResult = async () => {
      if (!optimizedContent.value) return;

      try {
        const response = await axios.get(
          `/api/pdf/files/${fileId.value}/download-optimized`,
          {
            headers: {
              Authorization: `Bearer ${store.getters["auth/getToken"]}`,
            },
            responseType: "blob",
          }
        );

        // 创建下载链接
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `${fileInfo.value.originalFilename.replace(
            /\.[^/.]+$/,
            ""
          )}_优化结果.md`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error("下载优化结果错误:", err);
        store.dispatch("setError", "下载优化结果失败，请稍后重试");
      }
    };

    // 返回上一页
    const goBack = () => {
      router.back();
    };

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return "";
      const date = new Date(dateString);
      return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    // 处理图片点击事件
    const handleImageClick = (image) => {
      window.open(image.src, "_blank");
    };

    // 组件挂载时加载内容
    onMounted(() => {
      loadFileContent();

      // 处理 ResizeObserver 错误 - 使用更可靠的方法
      const errorHandler = (event) => {
        if (event.message && event.message.includes("ResizeObserver")) {
          // 阻止错误传播
          event.stopImmediatePropagation();
          event.preventDefault();
          return false;
        }
      };

      window.addEventListener("error", errorHandler, true);

      // 添加防抖处理，减少重排和重绘
      let resizeTimeout;
      const handleResize = () => {
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
          // 不再触发完整的重新渲染，只更新布局
          const mdEditors = document.querySelectorAll(".v-md-editor");
          if (mdEditors.length > 0) {
            mdEditors.forEach((editor) => {
              // 触发布局更新而不是完全重新渲染
              editor.style.minHeight = editor.offsetHeight - 0.1 + "px";
              setTimeout(() => {
                editor.style.minHeight = "";
              }, 10);
            });
          }
        }, 300);
      };

      window.addEventListener("resize", handleResize);

      // 组件卸载时清理事件监听器
      return () => {
        window.removeEventListener("error", errorHandler, true);
        window.removeEventListener("resize", handleResize);
      };
    });

    return {
      fileInfo,
      originalContent,
      optimizedContent,
      isLoading,
      isOptimizing,
      error,
      optimizationPrompt,
      loadFileContent,
      optimizeContent,
      downloadOptimizedResult,
      goBack,
      formatDate,
      handleImageClick,
    };
  },
};
</script>

<style scoped>
/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 优化Markdown预览样式 */
:deep(.markdown-preview) {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
}

:deep(.markdown-preview p) {
  margin-bottom: 0.75rem;
  line-height: 1.6;
}

:deep(.markdown-preview h1),
:deep(.markdown-preview h2),
:deep(.markdown-preview h3),
:deep(.markdown-preview h4),
:deep(.markdown-preview h5),
:deep(.markdown-preview h6) {
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  font-weight: 600;
}

:deep(.markdown-preview img) {
  max-width: 100%;
  border-radius: 4px;
  margin: 0.5rem 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

:deep(.markdown-preview pre) {
  margin: 0.75rem 0;
  padding: 1rem;
  border-radius: 4px;
  background-color: #f8f9fa;
  overflow-x: auto;
}

:deep(.markdown-preview code) {
  font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.9em;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  background-color: rgba(27, 31, 35, 0.05);
}

:deep(.markdown-preview pre code) {
  padding: 0;
  background-color: transparent;
}

:deep(.markdown-preview table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75rem 0;
}

:deep(.markdown-preview th),
:deep(.markdown-preview td) {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
}

:deep(.markdown-preview th) {
  background-color: #f8fafc;
  font-weight: 600;
}

:deep(.markdown-preview tr:nth-child(even)) {
  background-color: #f8fafc;
}

/* 优化性能 */
:deep(.markdown-preview) {
  contain: content;
  will-change: transform;
  transform: translateZ(0);
  overflow: hidden; /* 防止溢出导致的布局问题 */
  position: relative; /* 创建新的层叠上下文 */
}

:deep(.v-md-editor__preview-wrapper) {
  contain: content;
  will-change: transform;
  transform: translateZ(0);
  position: relative;
  overflow: visible;
  height: auto !important; /* 防止高度计算问题 */
}

/* 禁用不必要的动画和过渡 */
:deep(.v-md-editor__preview-wrapper *) {
  transition: none !important;
  animation: none !important;
}

/* 优化图片加载 */
:deep(.markdown-preview img) {
  max-width: 100%;
  height: auto !important;
  contain: paint;
  content-visibility: auto;
}

/* 优化表格渲染 */
:deep(.markdown-preview table) {
  table-layout: fixed; /* 使用固定表格布局算法 */
}

/* 减少布局抖动 */
:deep(.v-md-editor) {
  contain: layout style;
  content-visibility: auto;
  contain-intrinsic-size: 1000px; /* 提供预估尺寸 */
}
</style>
