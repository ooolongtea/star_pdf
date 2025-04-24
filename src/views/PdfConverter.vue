<template>
  <div class="pdf-converter">
    <div class="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
      <h1 class="text-2xl font-bold text-gray-800 mb-6">PDF 转换工具</h1>

      <!-- 服务器状态 -->
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center">
          <div
            class="w-3 h-3 rounded-full mr-2"
            :class="serverStatus.connected ? 'bg-green-500' : 'bg-red-500'"
          ></div>
          <span class="text-sm"
            >远程服务器状态: {{ serverStatus.message }}</span
          >
        </div>
        <button
          @click="testConnection"
          class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 focus:outline-none"
          :disabled="isTestingConnection"
        >
          <span v-if="isTestingConnection">测试中...</span>
          <span v-else>测试连接</span>
        </button>
      </div>

      <!-- 上传区域 -->
      <div
        class="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-6 text-center"
        :class="{ 'border-blue-500 bg-blue-50': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onFileDrop"
      >
        <div v-if="!selectedFile">
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
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            ></path>
          </svg>
          <p class="mt-2 text-sm text-gray-600">
            拖放文件到这里，或者
            <label class="cursor-pointer text-blue-600 hover:text-blue-800">
              <span>浏览文件</span>
              <input
                type="file"
                class="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.png"
                @change="onFileChange"
              />
            </label>
          </p>
          <p class="mt-1 text-xs text-gray-500">
            支持的格式: PDF, Word (DOC, DOCX), PowerPoint (PPT, PPTX), 图片
            (JPG, PNG)
          </p>
        </div>
        <div v-else class="flex items-center justify-between">
          <div class="flex items-center">
            <svg
              class="h-8 w-8 text-blue-500"
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
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-900">
                {{ selectedFile.name }}
              </p>
              <p class="text-xs text-gray-500">
                {{ formatFileSize(selectedFile.size) }}
              </p>
            </div>
          </div>
          <button
            @click="selectedFile = null"
            class="text-red-600 hover:text-red-800 focus:outline-none"
          >
            <svg
              class="h-5 w-5"
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
      </div>

      <!-- 转换选项 -->
      <div class="mb-6">
        <h2 class="text-lg font-medium text-gray-800 mb-3">转换选项</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >解析方法</label
            >
            <select
              v-model="parseMethod"
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="auto">自动检测</option>
              <option value="ocr">OCR 识别</option>
              <option value="text">文本提取</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >调试模式</label
            >
            <div class="flex items-center">
              <input
                type="checkbox"
                id="debug-mode"
                v-model="debugMode"
                class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label for="debug-mode" class="ml-2 text-sm text-gray-700"
                >启用调试信息</label
              >
            </div>
          </div>
        </div>
      </div>

      <!-- 转换按钮 -->
      <div class="flex justify-center">
        <button
          @click="convertFile"
          class="px-6 py-3 bg-blue-600 text-white font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          :disabled="!selectedFile || isConverting"
          :class="{
            'opacity-50 cursor-not-allowed': !selectedFile || isConverting,
          }"
        >
          <span v-if="isConverting" class="flex items-center">
            <svg
              class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
            正在转换...
          </span>
          <span v-else>开始转换</span>
        </button>
      </div>

      <!-- 结果区域 -->
      <div v-if="conversionResult" class="mt-8 border-t pt-6">
        <h2 class="text-lg font-medium text-gray-800 mb-3">转换结果</h2>

        <div
          v-if="conversionError"
          class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md"
        >
          <p class="font-medium">转换失败</p>
          <p class="text-sm">{{ conversionError }}</p>
        </div>

        <div v-else>
          <div
            class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4"
          >
            <p class="font-medium">转换成功</p>
            <p class="text-sm">文件已成功转换，您可以下载或查看结果。</p>
          </div>

          <div class="flex flex-wrap gap-3">
            <a
              :href="conversionResult.markdownUrl"
              download
              class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                class="mr-2 h-5 w-5 text-gray-500"
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
              下载 Markdown
            </a>

            <button
              @click="showMarkdownPreview = true"
              class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                class="mr-2 h-5 w-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                ></path>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                ></path>
              </svg>
              预览 Markdown
            </button>

            <a
              v-if="
                conversionResult.extractedFormulas &&
                conversionResult.extractedFormulas.length > 0
              "
              :href="conversionResult.formulasUrl"
              download
              class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                class="mr-2 h-5 w-5 text-gray-500"
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
              下载提取的化学式
            </a>

            <button
              v-if="
                conversionResult.extractedFormulas &&
                conversionResult.extractedFormulas.length > 0
              "
              @click="showFormulasPreview = true"
              class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                class="mr-2 h-5 w-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                ></path>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                ></path>
              </svg>
              查看提取的化学式
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Markdown 预览模态框 -->
    <div v-if="showMarkdownPreview" class="fixed inset-0 z-10 overflow-y-auto">
      <div
        class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
      >
        <div class="fixed inset-0 transition-opacity" aria-hidden="true">
          <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <div
          class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full"
        >
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Markdown 预览
                </h3>
                <div class="bg-gray-50 p-4 rounded-md overflow-auto max-h-96">
                  <pre class="text-sm text-gray-800 whitespace-pre-wrap">{{
                    markdownContent
                  }}</pre>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              @click="showMarkdownPreview = false"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 化学式预览模态框 -->
    <div v-if="showFormulasPreview" class="fixed inset-0 z-10 overflow-y-auto">
      <div
        class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
      >
        <div class="fixed inset-0 transition-opacity" aria-hidden="true">
          <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <div
          class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full"
        >
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
                  提取的化学式
                </h3>
                <div class="overflow-auto max-h-96">
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          序号
                        </th>
                        <th
                          scope="col"
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          化学式
                        </th>
                        <th
                          scope="col"
                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          页码
                        </th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      <tr
                        v-for="(
                          formula, index
                        ) in conversionResult.extractedFormulas"
                        :key="index"
                      >
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          {{ index + 1 }}
                        </td>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                        >
                          {{ formula.formula }}
                        </td>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          {{ formula.page }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              @click="showFormulasPreview = false"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import { useStore } from "vuex";
import axios from "axios";

export default {
  name: "PdfConverter",
  setup() {
    const store = useStore();

    // 服务器状态
    const serverStatus = ref({
      connected: false,
      message: "未连接",
    });
    const isTestingConnection = ref(false);

    // 文件上传相关
    const selectedFile = ref(null);
    const isDragging = ref(false);

    // 转换选项
    const parseMethod = ref("auto");
    const debugMode = ref(false);

    // 转换状态和结果
    const isConverting = ref(false);
    const conversionResult = ref(null);
    const conversionError = ref(null);

    // 预览相关
    const showMarkdownPreview = ref(false);
    const showFormulasPreview = ref(false);
    const markdownContent = ref("");

    // 处理文件选择
    const onFileChange = (event) => {
      const file = event.target.files[0];
      if (file) {
        selectedFile.value = file;
      }
    };

    // 处理文件拖放
    const onFileDrop = (event) => {
      isDragging.value = false;
      const file = event.dataTransfer.files[0];
      if (file) {
        selectedFile.value = file;
      }
    };

    // 格式化文件大小
    const formatFileSize = (bytes) => {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    // 测试与远程服务器的连接
    const testConnection = async () => {
      if (isTestingConnection.value) return;

      isTestingConnection.value = true;
      serverStatus.value = {
        connected: false,
        message: "连接中...",
      };

      try {
        const response = await axios.get("/api/pdf/test-connection", {
          headers: {
            Authorization: `Bearer ${store.getters["auth/getToken"]}`,
          },
        });

        if (response.data.success) {
          serverStatus.value = {
            connected: true,
            message: "已连接",
          };
          console.log("远程服务器连接成功:", response.data);
        } else {
          serverStatus.value = {
            connected: false,
            message: "连接失败",
          };
          console.error("远程服务器连接失败:", response.data.message);
        }
      } catch (error) {
        serverStatus.value = {
          connected: false,
          message:
            "连接失败: " + (error.response?.data?.message || error.message),
        };
        console.error("远程服务器连接测试错误:", error);
      } finally {
        isTestingConnection.value = false;
      }
    };

    // 页面加载时自动测试连接
    onMounted(() => {
      testConnection();
    });

    // 转换文件
    const convertFile = async () => {
      if (!selectedFile.value) return;

      isConverting.value = true;
      conversionResult.value = null;
      conversionError.value = null;

      try {
        // 创建 FormData 对象
        const formData = new FormData();
        formData.append("file", selectedFile.value);
        formData.append("parseMethod", parseMethod.value);
        formData.append("debugMode", debugMode.value);

        // 发送请求
        const response = await axios.post("/api/pdf/convert", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${store.getters["auth/getToken"]}`,
          },
        });

        if (response.data.success) {
          conversionResult.value = response.data.data;

          // 获取 Markdown 内容用于预览
          if (conversionResult.value.markdownUrl) {
            const markdownResponse = await axios.get(
              conversionResult.value.markdownUrl
            );
            markdownContent.value = markdownResponse.data;
          }

          store.dispatch("setNotification", {
            type: "success",
            message: "文件转换成功！",
          });
        } else {
          conversionError.value =
            response.data.message || "转换失败，请稍后重试";
          store.dispatch("setError", conversionError.value);
        }
      } catch (error) {
        console.error("文件转换错误:", error);
        conversionError.value =
          error.response?.data?.message || "转换失败，请稍后重试";
        store.dispatch("setError", conversionError.value);
      } finally {
        isConverting.value = false;
      }
    };

    return {
      // 服务器状态
      serverStatus,
      isTestingConnection,
      testConnection,

      // 文件上传
      selectedFile,
      isDragging,
      onFileChange,
      onFileDrop,
      formatFileSize,

      // 转换选项
      parseMethod,
      debugMode,

      // 转换状态和结果
      isConverting,
      conversionResult,
      conversionError,
      convertFile,

      // 预览相关
      showMarkdownPreview,
      showFormulasPreview,
      markdownContent,
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
</style>
