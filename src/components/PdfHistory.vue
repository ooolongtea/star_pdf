<template>
  <div class="pdf-history">
    <h2 class="text-xl font-semibold text-gray-800 mb-4">历史转换记录</h2>

    <div v-if="loading" class="flex justify-center py-8">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"
      ></div>
    </div>

    <div
      v-else-if="error"
      class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md"
    >
      <p class="font-medium">加载失败</p>
      <p class="text-sm">{{ error }}</p>
    </div>

    <div v-else-if="files.length === 0" class="text-center py-8 text-gray-500">
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
        ></path>
      </svg>
      <p class="mt-2">暂无转换记录</p>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              文件名
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              状态
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              转换时间
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              有效期
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="file in files"
            :key="file.id"
            :class="{ 'bg-red-50': file.isExpired }"
          >
            <td class="px-4 py-3 whitespace-nowrap">
              <div class="flex items-center">
                <div
                  class="flex-shrink-0 h-8 w-8 flex items-center justify-center"
                >
                  <svg
                    class="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    ></path>
                  </svg>
                </div>
                <div class="ml-2">
                  <div
                    class="text-sm font-medium text-gray-900 truncate max-w-xs"
                    :title="file.originalFilename"
                  >
                    {{ file.originalFilename }}
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ formatFileSize(file.resultsSize || 0) }}
                  </div>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <span
                class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                :class="{
                  'bg-green-100 text-green-800': file.status === 'completed',
                  'bg-yellow-100 text-yellow-800': file.status === 'processing',
                  'bg-red-100 text-red-800': file.status === 'failed',
                }"
              >
                {{ getStatusText(file.status) }}
              </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
              {{ formatDate(file.createdAt) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
              <span
                v-if="file.expiresAt"
                :class="{ 'text-red-500': file.isExpired }"
              >
                {{ file.isExpired ? "已过期" : formatDate(file.expiresAt) }}
              </span>
              <span v-else>永久</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium">
              <div class="flex space-x-2">
                <button
                  v-if="file.status === 'completed'"
                  @click="viewFile(file)"
                  class="text-blue-600 hover:text-blue-900"
                >
                  查看
                </button>
                <button
                  v-if="file.status === 'completed'"
                  @click="downloadAllResults(file.id)"
                  class="text-green-600 hover:text-green-900"
                >
                  下载
                </button>
                <button
                  @click="deleteFile(file.id)"
                  class="text-red-600 hover:text-red-900"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 文件预览对话框 -->
    <div
      v-if="showPreview"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div
        class="bg-white rounded-lg shadow-xl w-11/12 max-w-4xl max-h-[90vh] flex flex-col"
      >
        <div class="px-6 py-4 border-b flex justify-between items-center">
          <h3
            class="text-lg font-medium text-gray-900 truncate max-w-lg"
            :title="selectedFile?.originalFilename"
          >
            {{ selectedFile?.originalFilename }}
          </h3>
          <button
            @click="closePreview"
            class="text-gray-400 hover:text-gray-500"
          >
            <svg
              class="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
        <div class="flex-1 overflow-auto p-6">
          <div v-if="loadingPreview" class="flex justify-center py-8">
            <div
              class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"
            ></div>
          </div>
          <div
            v-else-if="previewError"
            class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md"
          >
            <p class="font-medium">加载失败</p>
            <p class="text-sm">{{ previewError }}</p>
          </div>
          <div v-else>
            <!-- Markdown 预览 -->
            <v-md-editor
              v-if="markdownContent"
              v-model="markdownContent"
              mode="preview"
              class="markdown-preview"
              :preview-theme="'github'"
              @image-click="handleImageClick"
            ></v-md-editor>

            <!-- 文件列表 -->
            <div
              v-if="
                fileResults && fileResults.files && fileResults.files.length > 0
              "
              class="mt-6"
            >
              <h4 class="text-lg font-medium text-gray-800 mb-3">所有文件</h4>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        文件名
                      </th>
                      <th
                        scope="col"
                        class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        大小
                      </th>
                      <th
                        scope="col"
                        class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        类型
                      </th>
                      <th
                        scope="col"
                        class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="(file, index) in fileResults.files" :key="index">
                      <td
                        class="px-4 py-3 whitespace-nowrap text-sm text-gray-900"
                      >
                        {{ file.name }}
                      </td>
                      <td
                        class="px-4 py-3 whitespace-nowrap text-sm text-gray-500"
                      >
                        {{ formatFileSize(file.size) }}
                      </td>
                      <td
                        class="px-4 py-3 whitespace-nowrap text-sm text-gray-500"
                      >
                        {{ file.type || "未知" }}
                      </td>
                      <td
                        class="px-4 py-3 whitespace-nowrap text-sm font-medium"
                      >
                        <button
                          @click="downloadSingleFile(file.url)"
                          class="text-blue-600 hover:text-blue-900"
                        >
                          下载
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t flex justify-end">
          <button
            @click="closePreview"
            class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick, watch } from "vue";
import axios from "axios";
import { useStore } from "vuex";

export default {
  name: "PdfHistory",
  setup() {
    const store = useStore();

    // 文件列表
    const files = ref([]);
    const loading = ref(false);
    const error = ref(null);

    // 预览相关
    const showPreview = ref(false);
    const selectedFile = ref(null);
    const loadingPreview = ref(false);
    const previewError = ref(null);
    const markdownContent = ref("");
    const fileResults = ref(null);

    // 处理图片点击事件
    const handleImageClick = (image) => {
      // 可以在这里实现图片预览功能
      console.log("图片点击:", image);
      // 如果需要，可以打开图片预览模态框
      window.open(image.src, "_blank");
    };

    // 处理Markdown内容
    const processMarkdownContent = () => {
      if (!markdownContent.value || !selectedFile.value) return;

      // 修复图片路径
      let content = markdownContent.value;

      // 替换Markdown格式的图片引用
      content = content.replace(
        /!\[([^\]]*)\]\(images\/([^)]+)\)/g,
        (_, alt, imgPath) => {
          return `![${alt || "图片"}](/api/pdf/files/${
            selectedFile.value.id
          }/images/${imgPath})`;
        }
      );

      // 替换HTML格式的图片引用
      content = content.replace(
        /<img([^>]*)src=["']images\/([^"']+)["']([^>]*)>/g,
        (_, before, imgPath, after) => {
          return `<img${before}src="/api/pdf/files/${selectedFile.value.id}/images/${imgPath}"${after}>`;
        }
      );

      // 更新Markdown内容
      markdownContent.value = content;
    };

    // 加载文件列表
    const loadFiles = async () => {
      loading.value = true;
      error.value = null;

      try {
        const response = await axios.get("/api/pdf/files", {
          headers: {
            Authorization: `Bearer ${store.getters["auth/getToken"]}`,
          },
        });

        if (response.data.success) {
          files.value = response.data.data;
        } else {
          error.value = response.data.message || "加载失败";
        }
      } catch (err) {
        console.error("加载文件列表错误:", err);
        error.value = err.response?.data?.message || "加载失败，请稍后重试";
      } finally {
        loading.value = false;
      }
    };

    // 查看文件
    const viewFile = async (file) => {
      selectedFile.value = file;
      showPreview.value = true;
      loadingPreview.value = true;
      previewError.value = null;
      markdownContent.value = "";
      fileResults.value = null;

      try {
        // 获取文件详情
        const detailsResponse = await axios.get(
          `/api/pdf/files/${file.id}/results`,
          {
            headers: {
              Authorization: `Bearer ${store.getters["auth/getToken"]}`,
            },
          }
        );

        if (detailsResponse.data.success) {
          fileResults.value = detailsResponse.data.data;

          // 获取Markdown内容
          if (file.markdownUrl) {
            const markdownResponse = await axios.get(file.markdownUrl);
            markdownContent.value = markdownResponse.data;

            // 处理Markdown内容中的图片路径
            nextTick(() => {
              processMarkdownContent();
            });
          }
        } else {
          previewError.value = detailsResponse.data.message || "加载失败";
        }
      } catch (err) {
        console.error("加载文件详情错误:", err);
        previewError.value =
          err.response?.data?.message || "加载失败，请稍后重试";
      } finally {
        loadingPreview.value = false;
      }
    };

    // 关闭预览
    const closePreview = () => {
      showPreview.value = false;
      selectedFile.value = null;
      markdownContent.value = "";
      fileResults.value = null;
    };

    // 下载所有结果
    const downloadAllResults = (fileId) => {
      const token = store.getters["auth/getToken"];
      // 创建一个临时链接元素
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = `/api/pdf/files/${fileId}/download-all`;

      // 添加授权头
      a.setAttribute("download", "");

      // 使用fetch进行带授权的下载
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
    };

    // 删除文件
    const deleteFile = async (fileId) => {
      if (!confirm("确定要删除此文件吗？此操作不可恢复。")) {
        return;
      }

      try {
        const response = await axios.delete(`/api/pdf/files/${fileId}`, {
          headers: {
            Authorization: `Bearer ${store.getters["auth/getToken"]}`,
          },
        });

        if (response.data.success) {
          store.dispatch("setNotification", {
            type: "success",
            message: "文件已删除",
          });

          // 重新加载文件列表
          loadFiles();

          // 如果正在预览被删除的文件，关闭预览
          if (selectedFile.value && selectedFile.value.id === fileId) {
            closePreview();
          }
        } else {
          store.dispatch("setError", response.data.message || "删除失败");
        }
      } catch (err) {
        console.error("删除文件错误:", err);
        store.dispatch(
          "setError",
          err.response?.data?.message || "删除失败，请稍后重试"
        );
      }
    };

    // 格式化文件大小
    const formatFileSize = (bytes) => {
      if (bytes === 0) return "0 B";

      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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

    // 获取状态文本
    const getStatusText = (status) => {
      switch (status) {
        case "completed":
          return "已完成";
        case "processing":
          return "处理中";
        case "failed":
          return "失败";
        default:
          return status;
      }
    };

    // 下载单个文件
    const downloadSingleFile = (url) => {
      const token = store.getters["auth/getToken"];

      // 使用fetch进行带授权的下载
      fetch(url, {
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
          // 从URL中提取文件名
          const urlParts = url.split("?");
          const queryParams = new URLSearchParams(urlParts[1]);
          const filePath = queryParams.get("path");
          const fileName = filePath ? filePath.split("/").pop() : "download";

          // 创建下载链接
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = downloadUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(downloadUrl);
          document.body.removeChild(a);
        })
        .catch((error) => {
          console.error("下载错误:", error);
          store.dispatch("setError", "下载失败，请稍后重试");
        });
    };

    // 监听Markdown内容变化
    watch(markdownContent, () => {
      // 当Markdown内容变化时，处理内容
      if (markdownContent.value && selectedFile.value) {
        nextTick(() => {
          processMarkdownContent();
        });
      }
    });

    // 组件挂载时加载文件列表
    onMounted(() => {
      loadFiles();
    });

    return {
      files,
      loading,
      error,
      showPreview,
      selectedFile,
      loadingPreview,
      previewError,
      markdownContent,
      fileResults,
      loadFiles,
      viewFile,
      closePreview,
      downloadAllResults,
      downloadSingleFile,
      deleteFile,
      formatFileSize,
      formatDate,
      getStatusText,
      handleImageClick,
      processMarkdownContent,
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

/* 表格样式 */
.prose {
  max-width: 100%;
}

/* v-md-editor 样式调整 */
.markdown-preview {
  max-width: 100%;
  height: auto;
}

/* 确保图片不超出容器 */
.markdown-preview img {
  max-width: 100%;
  height: auto;
}

/* 调整代码块样式 */
.markdown-preview pre {
  border-radius: 4px;
  margin: 1em 0;
}

/* 调整表格样式 */
.markdown-preview table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}

.markdown-preview th,
.markdown-preview td {
  border: 1px solid #ddd;
  padding: 8px;
}
</style>
