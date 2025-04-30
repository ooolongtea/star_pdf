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

    <div v-else>
      <div class="mb-4 flex justify-between items-center">
        <div class="flex space-x-2">
          <button
            v-if="selectedFiles.length > 0"
            @click="confirmDeleteSelected"
            class="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <svg
              class="mr-1.5 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              ></path>
            </svg>
            删除选中 ({{ selectedFiles.length }})
          </button>

          <button
            v-if="selectedFiles.length > 0"
            @click="downloadSelectedFiles"
            class="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <svg
              class="mr-1.5 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              ></path>
            </svg>
            下载选中 ({{ selectedFiles.length }})
          </button>
        </div>

        <div>
          <button
            v-if="selectedFiles.length > 0"
            @click="clearSelection"
            class="text-sm text-gray-500 hover:text-gray-700"
          >
            清除选择
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  :checked="isAllSelected"
                  @change="toggleSelectAll"
                />
              </th>
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
              :class="{
                'bg-red-50': file.isExpired,
                'bg-blue-50': isFileSelected(file.id),
              }"
            >
              <td class="px-4 py-3 whitespace-nowrap">
                <input
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  :checked="isFileSelected(file.id)"
                  @change="toggleFileSelection(file.id)"
                />
              </td>
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
                    'bg-yellow-100 text-yellow-800':
                      file.status === 'processing',
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
import { ref, onMounted, nextTick, watch, computed } from "vue";
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

    // 选中的文件
    const selectedFiles = ref([]);

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

      // 查找对应的文件信息，以获取原始文件名
      const file = files.value.find((f) => f.id === fileId);
      let fileName = "结果文件.zip";

      // 如果找到文件信息，使用原始文件名
      if (file && file.originalFilename) {
        // 移除扩展名，添加结果文件后缀
        const fileNameWithoutExt = file.originalFilename.replace(
          /\.[^/.]+$/,
          ""
        );
        // 确保文件名不包含非法字符
        const safeFileName = fileNameWithoutExt.replace(/[\\/:*?"<>|]/g, "_");
        fileName = `${safeFileName}_结果文件.zip`;
      }

      // 使用fetch进行带授权的下载
      fetch(`/api/pdf/files/${fileId}/download-all`, {
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
          // 创建下载链接
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = fileName;
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

      // 从URL中提取文件ID
      const urlParts = url.split("/");
      const fileIdIndex = urlParts.findIndex((part) => part === "files") + 1;
      const fileId =
        fileIdIndex < urlParts.length ? urlParts[fileIdIndex] : null;

      // 查找对应的文件信息，以获取原始文件名
      const file = fileId ? files.value.find((f) => f.id === fileId) : null;

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
          // 从URL中提取文件路径
          const urlParts = url.split("?");
          const queryParams = new URLSearchParams(urlParts[1]);
          const filePath = queryParams.get("path");

          // 获取文件名和扩展名
          let fileName = filePath ? filePath.split("/").pop() : "download";
          const fileExt = fileName.includes(".")
            ? fileName.substring(fileName.lastIndexOf("."))
            : "";

          // 如果找到文件信息，使用原始文件名作为前缀
          if (file && file.originalFilename) {
            // 移除扩展名
            const fileNameWithoutExt = file.originalFilename.replace(
              /\.[^/.]+$/,
              ""
            );
            // 确保文件名不包含非法字符
            const safeFileName = fileNameWithoutExt.replace(
              /[\\/:*?"<>|]/g,
              "_"
            );

            // 根据文件类型决定最终文件名
            if (
              fileName.match(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+$/i
              )
            ) {
              // UUID格式的文件名，直接使用原始文件名
              fileName = `${safeFileName}${fileExt}`;
            } else if (fileExt.toLowerCase() === ".md") {
              // Markdown文件使用原始文件名
              fileName = `${safeFileName}.md`;
            } else if (fileId && fileName.startsWith(fileId)) {
              // 以文件ID开头的文件，使用原始文件名
              fileName = `${safeFileName}${fileExt}`;
            } else {
              // 其他文件，添加原始文件名作为前缀
              fileName = `${safeFileName}_${fileName}`;
            }
          }

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

    // 文件选择相关函数
    const isFileSelected = (fileId) => {
      return selectedFiles.value.includes(fileId);
    };

    const toggleFileSelection = (fileId) => {
      const index = selectedFiles.value.indexOf(fileId);
      if (index === -1) {
        selectedFiles.value.push(fileId);
      } else {
        selectedFiles.value.splice(index, 1);
      }
    };

    const isAllSelected = computed(() => {
      return (
        files.value.length > 0 &&
        selectedFiles.value.length === files.value.length
      );
    });

    const toggleSelectAll = () => {
      if (isAllSelected.value) {
        // 取消全选
        selectedFiles.value = [];
      } else {
        // 全选
        selectedFiles.value = files.value.map((file) => file.id);
      }
    };

    const clearSelection = () => {
      selectedFiles.value = [];
    };

    // 批量删除
    const confirmDeleteSelected = () => {
      if (selectedFiles.value.length === 0) return;

      const count = selectedFiles.value.length;
      if (confirm(`确定要删除选中的 ${count} 个文件吗？此操作不可恢复。`)) {
        deleteSelectedFiles();
      }
    };

    const deleteSelectedFiles = async () => {
      if (selectedFiles.value.length === 0) return;

      const filesToDelete = [...selectedFiles.value]; // 创建副本，避免在循环中修改原数组
      let successCount = 0;
      let errorCount = 0;

      for (const fileId of filesToDelete) {
        try {
          const response = await axios.delete(`/api/pdf/files/${fileId}`, {
            headers: {
              Authorization: `Bearer ${store.getters["auth/getToken"]}`,
            },
          });

          if (response.data.success) {
            successCount++;
            // 从选中列表中移除
            const index = selectedFiles.value.indexOf(fileId);
            if (index !== -1) {
              selectedFiles.value.splice(index, 1);
            }
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error(`删除文件 ${fileId} 错误:`, err);
          errorCount++;
        }
      }

      // 显示结果通知
      if (errorCount === 0) {
        store.dispatch("setNotification", {
          type: "success",
          message: `成功删除 ${successCount} 个文件`,
        });
      } else {
        store.dispatch("setNotification", {
          type: "warning",
          message: `成功删除 ${successCount} 个文件，${errorCount} 个文件删除失败`,
        });
      }

      // 重新加载文件列表
      loadFiles();
    };

    // 批量下载
    const downloadSelectedFiles = async () => {
      if (selectedFiles.value.length === 0) return;

      // 如果只选择了一个文件，直接下载
      if (selectedFiles.value.length === 1) {
        downloadAllResults(selectedFiles.value[0]);
        return;
      }

      store.dispatch("setNotification", {
        type: "info",
        message: "正在准备下载多个文件，请稍候...",
      });

      try {
        // 使用批量下载API
        const token = store.getters["auth/getToken"];

        // 创建一个隐藏的表单，用于提交POST请求
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/api/pdf/files/batch-download";
        form.style.display = "none";

        // 添加文件ID列表
        const fileIdsInput = document.createElement("input");
        fileIdsInput.name = "fileIds";
        fileIdsInput.value = JSON.stringify(selectedFiles.value);
        form.appendChild(fileIdsInput);

        // 添加认证令牌
        const tokenInput = document.createElement("input");
        tokenInput.name = "token";
        tokenInput.value = token;
        form.appendChild(tokenInput);

        // 添加表单到文档并提交
        document.body.appendChild(form);

        // 创建一个iframe来接收响应
        const iframe = document.createElement("iframe");
        iframe.name = "download-iframe";
        iframe.style.display = "none";
        document.body.appendChild(iframe);

        // 设置表单目标为iframe
        form.target = "download-iframe";

        // 提交表单
        form.submit();

        // 清理
        setTimeout(() => {
          document.body.removeChild(form);
          document.body.removeChild(iframe);
        }, 5000);
      } catch (error) {
        console.error("批量下载错误:", error);
        store.dispatch("setError", "批量下载失败，请稍后重试");

        // 回退到逐个下载
        for (const fileId of selectedFiles.value) {
          await new Promise((resolve) => {
            setTimeout(() => {
              downloadAllResults(fileId);
              resolve();
            }, 1000); // 间隔1秒下载，避免浏览器阻止多个下载
          });
        }
      }
    };

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
      selectedFiles,
      isAllSelected,

      // 文件操作
      loadFiles,
      viewFile,
      closePreview,
      downloadAllResults,
      downloadSingleFile,
      deleteFile,

      // 批量操作
      isFileSelected,
      toggleFileSelection,
      toggleSelectAll,
      clearSelection,
      confirmDeleteSelected,
      deleteSelectedFiles,
      downloadSelectedFiles,

      // 工具函数
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
