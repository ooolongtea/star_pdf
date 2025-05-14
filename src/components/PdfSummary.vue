<template>
  <div class="pdf-summary">
    <div class="bg-white rounded-lg shadow-md p-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-medium text-gray-800">专利信息总结</h2>
        <div class="flex space-x-2">
          <button
            v-if="!summaryContent && !isGenerating"
            @click="generateSummary"
            class="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
          >
            生成总结
          </button>
          <button
            v-if="summaryContent"
            @click="downloadSummary"
            class="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200"
          >
            下载总结
          </button>
        </div>
      </div>

      <div
        v-if="isGenerating"
        class="flex flex-col items-center justify-center py-8"
      >
        <div
          class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"
        ></div>
        <p class="text-gray-600">正在生成专利总结，请稍候...</p>
        <p class="text-gray-500 text-sm mt-2">
          这可能需要一些时间，取决于文档的长度和复杂度
        </p>
      </div>

      <div
        v-else-if="error"
        class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md"
      >
        <p class="font-medium">生成总结失败</p>
        <p class="text-sm">{{ error }}</p>
      </div>

      <div
        v-else-if="!summaryContent"
        class="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg"
      >
        <svg
          class="w-12 h-12 text-gray-400 mb-3"
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
        <p class="text-gray-600 text-center">
          点击"生成总结"按钮，使用AI提取专利关键信息
        </p>
        <p class="text-gray-500 text-sm text-center mt-2">
          AI将分析专利文档，提取关键信息，并按照标准模板进行整理
        </p>
      </div>

      <v-md-editor
        v-else
        v-model="summaryContent"
        mode="preview"
        class="markdown-preview enhanced-markdown"
        :preview-theme="'github'"
        :default-show-toc="true"
        :include-level="[1, 2, 3]"
      ></v-md-editor>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import { useStore } from "vuex";
import axios from "../plugins/axios";

export default {
  name: "PdfSummary",
  props: {
    fileId: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const store = useStore();
    const summaryContent = ref("");
    const isGenerating = ref(false);
    const error = ref(null);

    // 检查是否已有总结内容
    const checkSummaryContent = async () => {
      try {
        const response = await axios.get(
          `/api/pdf/files/${props.fileId}/summary`,
          {
            headers: {
              Authorization: `Bearer ${store.getters["auth/getToken"]}`,
            },
          }
        );

        if (response.data.success && response.data.data) {
          summaryContent.value = response.data.data;
        }
      } catch (err) {
        // 如果没有总结内容，不显示错误
        console.log("没有找到总结内容");
      }
    };

    // 生成总结
    const generateSummary = async () => {
      if (isGenerating.value) return;

      isGenerating.value = true;
      error.value = null;

      try {
        const response = await axios.post(
          `/api/pdf/files/${props.fileId}/summary`,
          {},
          {
            headers: {
              Authorization: `Bearer ${store.getters["auth/getToken"]}`,
            },
          }
        );

        if (response.data.success) {
          summaryContent.value = response.data.data;
          store.dispatch("setNotification", {
            type: "success",
            message: "专利总结生成成功！",
          });
        } else {
          error.value = response.data.message || "生成总结失败";
        }
      } catch (err) {
        console.error("生成总结错误:", err);
        error.value = err.response?.data?.message || "生成总结失败，请稍后重试";

        // 检查是否是API密钥错误
        if (
          err.response?.data?.message?.includes("API密钥无效") ||
          err.response?.data?.message?.includes("API配额已用尽")
        ) {
          error.value = err.response.data.message;
        }
      } finally {
        isGenerating.value = false;
      }
    };

    // 下载总结
    const downloadSummary = async () => {
      try {
        // 创建一个隐藏的a标签用于下载
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = `/api/pdf/files/${props.fileId}/download-summary`;
        a.download = "专利总结.md";

        // 添加授权头
        const token = store.getters["auth/getToken"];
        fetch(a.href, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("下载失败");
            }
            return response.blob();
          })
          .then((blob) => {
            const url = window.URL.createObjectURL(blob);
            a.href = url;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          })
          .catch((error) => {
            console.error("下载错误:", error);
            store.dispatch("setError", "下载失败，请稍后重试");
          });
      } catch (err) {
        console.error("下载总结错误:", err);
        store.dispatch("setError", "下载失败，请稍后重试");
      }
    };

    // 组件挂载时检查是否已有总结内容
    onMounted(() => {
      checkSummaryContent();
    });

    return {
      summaryContent,
      isGenerating,
      error,
      generateSummary,
      downloadSummary,
    };
  },
};
</script>

<style scoped>
.markdown-preview {
  max-height: 70vh;
  overflow-y: auto;
  font-size: 1rem;
  line-height: 1.7;
}

/* 增强版Markdown样式 */
.enhanced-markdown :deep(h1) {
  font-size: 1.8rem;
  font-weight: 600;
  color: #1e40af;
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.enhanced-markdown :deep(h2) {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2563eb;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}

.enhanced-markdown :deep(h3) {
  font-size: 1.25rem;
  font-weight: 600;
  color: #3b82f6;
  margin-top: 1.25rem;
  margin-bottom: 0.75rem;
}

.enhanced-markdown :deep(p) {
  margin-bottom: 1rem;
}

.enhanced-markdown :deep(ul),
.enhanced-markdown :deep(ol) {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.enhanced-markdown :deep(li) {
  margin-bottom: 0.5rem;
}

.enhanced-markdown :deep(blockquote) {
  border-left: 4px solid #3b82f6;
  padding-left: 1rem;
  color: #4b5563;
  font-style: italic;
  margin: 1rem 0;
  background-color: #f3f4f6;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
}

/* 确保图片不超出容器并添加样式 */
.enhanced-markdown :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
  margin: 1rem 0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease-in-out;
  opacity: 0;
  animation: fadeIn 0.5s ease-in-out forwards;
  background-color: #f3f4f6;
  min-height: 100px;
}

@keyframes fadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.enhanced-markdown :deep(img:hover) {
  transform: scale(1.01);
}

/* 调整代码块样式 */
.enhanced-markdown :deep(pre) {
  border-radius: 0.5rem;
  margin: 1rem 0;
  padding: 1rem;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  overflow-x: auto;
}

.enhanced-markdown :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 0.9rem;
  padding: 0.2rem 0.4rem;
  border-radius: 0.25rem;
  background-color: #f1f5f9;
  color: #ef4444;
}

.enhanced-markdown :deep(pre code) {
  padding: 0;
  background-color: transparent;
  color: inherit;
}

/* 调整表格样式 */
.enhanced-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5rem 0;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

.enhanced-markdown :deep(thead) {
  background-color: #f3f4f6;
}

.enhanced-markdown :deep(th) {
  background-color: #f3f4f6;
  font-weight: 600;
  text-align: left;
  padding: 0.75rem 1rem;
  border-bottom: 2px solid #e5e7eb;
  color: #374151;
}

.enhanced-markdown :deep(td) {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  border-right: 1px solid #e5e7eb;
}

.enhanced-markdown :deep(tr:last-child td) {
  border-bottom: none;
}

.enhanced-markdown :deep(td:last-child) {
  border-right: none;
}

.enhanced-markdown :deep(tr:nth-child(even)) {
  background-color: #f9fafb;
}

.enhanced-markdown :deep(tr:hover) {
  background-color: #f3f4f6;
}

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
</style>
