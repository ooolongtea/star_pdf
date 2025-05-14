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
        <div v-if="selectedFiles.length === 0">
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
                multiple
              />
            </label>
          </p>
          <p class="mt-1 text-xs text-gray-500">
            支持的格式: PDF, Word (DOC, DOCX), PowerPoint (PPT, PPTX), 图片
            (JPG, PNG)
          </p>
          <p class="mt-1 text-xs text-gray-500">文件大小限制: 50MB</p>
        </div>
        <div v-else class="w-full">
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-sm font-medium text-gray-700">
              已选择 {{ selectedFiles.length }} 个文件
            </h3>
            <button
              @click="clearFiles"
              class="text-red-600 hover:text-red-800 focus:outline-none text-sm"
            >
              清除全部
            </button>
          </div>

          <div
            class="max-h-60 overflow-y-auto border border-gray-200 rounded-md"
          >
            <ul class="divide-y divide-gray-200">
              <li
                v-for="(file, index) in selectedFiles"
                :key="index"
                class="px-4 py-3 flex items-center justify-between"
              >
                <div class="flex items-center">
                  <svg
                    class="h-6 w-6 text-blue-500 flex-shrink-0"
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
                  <div class="ml-3 truncate">
                    <p
                      class="text-sm font-medium text-gray-900 truncate"
                      :title="file.name"
                    >
                      {{ file.name }}
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ formatFileSize(file.size) }}
                    </p>
                  </div>
                </div>
                <button
                  @click="removeFile(index)"
                  class="text-red-600 hover:text-red-800 focus:outline-none ml-2"
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
              </li>
            </ul>
          </div>

          <div class="mt-3 flex justify-end">
            <label
              class="cursor-pointer px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 focus:outline-none"
            >
              <span>添加更多文件</span>
              <input
                type="file"
                class="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.png"
                @change="onFileChange"
                multiple
              />
            </label>
          </div>
        </div>
      </div>

      <!-- 转换选项 -->
      <div class="mb-6">
        <h2 class="text-lg font-medium text-gray-800 mb-3">转换选项</h2>
        <div class="text-sm text-gray-600 mb-2">
          PDF转换使用默认设置，无需额外配置。上传文件后点击"开始转换"即可。
        </div>
      </div>

      <!-- 转换按钮 -->
      <div class="flex justify-center">
        <button
          @click="convertFiles"
          class="px-6 py-3 bg-blue-600 text-white font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          :disabled="selectedFiles.length === 0 || isConverting"
          :class="{
            'opacity-50 cursor-not-allowed':
              selectedFiles.length === 0 || isConverting,
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
            正在转换 ({{ convertedCount }}/{{ selectedFiles.length }})...
          </span>
          <span v-else
            >开始转换
            {{
              selectedFiles.length > 1 ? `(${selectedFiles.length}个文件)` : ""
            }}</span
          >
        </button>
      </div>

      <!-- 结果区域 -->
      <div v-if="conversionResults.length > 0" class="mt-8 border-t pt-6">
        <h2 class="text-lg font-medium text-gray-800 mb-3">转换结果</h2>

        <div
          v-if="hasErrors"
          class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md mb-4"
        >
          <p class="font-medium">部分文件转换失败</p>
          <p class="text-sm">部分文件转换过程中出现错误，请查看详细结果。</p>
        </div>

        <div
          v-else
          class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4"
        >
          <p class="font-medium">转换成功</p>
          <p class="text-sm">所有文件已成功转换，您可以下载或查看结果。</p>
        </div>

        <!-- 批量操作按钮 -->
        <div
          v-if="conversionResults.length > 1"
          class="mb-4 flex flex-wrap gap-3"
        >
          <button
            @click="downloadAllSelectedResults"
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L7 8m4-4v12"
              ></path>
            </svg>
            批量下载所有结果
          </button>
        </div>

        <!-- 结果列表 -->
        <div class="space-y-4">
          <div
            v-for="(result, index) in conversionResults"
            :key="index"
            class="border rounded-lg p-4"
            :class="{
              'border-red-200 bg-red-50': result.error,
              'border-gray-200': !result.error,
            }"
          >
            <div class="flex justify-between items-start mb-2">
              <h3
                class="text-md font-medium text-gray-800 truncate max-w-md"
                :title="result.originalFilename"
              >
                {{ result.originalFilename }}
              </h3>
              <span
                class="px-2 py-1 text-xs font-semibold rounded-full"
                :class="{
                  'bg-green-100 text-green-800': !result.error,
                  'bg-red-100 text-red-800': result.error,
                }"
              >
                {{ result.error ? "失败" : "成功" }}
              </span>
            </div>

            <div v-if="result.error" class="text-sm text-red-600 mb-2">
              {{ result.error }}
            </div>

            <div v-else class="flex flex-wrap gap-2">
              <a
                v-if="result.markdownUrl"
                :href="result.markdownUrl"
                download
                class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                <svg
                  class="mr-1 h-4 w-4 text-gray-500"
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
                @click="downloadAllResults(result.fileId)"
                class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                <svg
                  class="mr-1 h-4 w-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L7 8m4-4v12"
                  ></path>
                </svg>
                下载所有文件
              </button>

              <button
                @click="previewMarkdown(result)"
                class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                <svg
                  class="mr-1 h-4 w-4 text-gray-500"
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
                预览
              </button>

              <a
                v-if="result.formulasUrl"
                :href="result.formulasUrl"
                download
                class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                <svg
                  class="mr-1 h-4 w-4 text-gray-500"
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
                下载化学式
              </a>
            </div>
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
            <div class="flex justify-between items-center mb-4">
              <h3
                class="text-lg leading-6 font-medium text-gray-900 truncate max-w-2xl"
                :title="previewingFile?.originalFilename"
              >
                {{ previewingFile?.originalFilename || "Markdown 预览" }}
              </h3>
              <button
                @click="closePreview"
                class="text-gray-400 hover:text-gray-500 focus:outline-none"
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
              <!-- 使用v-md-editor显示Markdown内容 -->
              <v-md-editor
                v-if="markdownContent"
                v-model="markdownContent"
                mode="preview"
                class="markdown-preview max-h-[60vh] overflow-auto"
                :preview-theme="'github'"
              ></v-md-editor>

              <!-- 如果没有内容显示提示 -->
              <div
                v-else
                class="bg-gray-50 p-4 rounded-md text-center text-gray-500"
              >
                无内容可预览
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              @click="closePreview"
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
            <div class="flex justify-between items-center mb-4">
              <h3
                class="text-lg leading-6 font-medium text-gray-900 truncate max-w-2xl"
                :title="previewingFile?.originalFilename"
              >
                {{ previewingFile?.originalFilename || "提取的化学式" }}
              </h3>
              <button
                @click="closeFormulaPreview"
                class="text-gray-400 hover:text-gray-500 focus:outline-none"
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

            <div v-if="loadingFormulas" class="flex justify-center py-8">
              <div
                class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"
              ></div>
            </div>
            <div
              v-else-if="formulasError"
              class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md"
            >
              <p class="font-medium">加载失败</p>
              <p class="text-sm">{{ formulasError }}</p>
            </div>
            <div
              v-else-if="extractedFormulas && extractedFormulas.length > 0"
              class="overflow-auto max-h-[60vh]"
            >
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50 sticky top-0">
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
                    v-for="(formula, index) in extractedFormulas"
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
            <div
              v-else
              class="bg-gray-50 p-4 rounded-md text-center text-gray-500"
            >
              未找到化学式
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              @click="closeFormulaPreview"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 历史转换记录 -->
    <div class="mt-12 border-t pt-8">
      <PdfHistory />
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from "vue";
import { useStore } from "vuex";
import axios from "../plugins/axios"; // 使用配置好的axios实例
import PdfHistory from "@/components/PdfHistory.vue";

export default {
  name: "PdfConverter",
  components: {
    PdfHistory,
  },
  setup() {
    const store = useStore();

    // 服务器状态
    const serverStatus = ref({
      connected: false,
      message: "未连接",
    });
    const isTestingConnection = ref(false);

    // 文件上传相关
    const selectedFiles = ref([]);
    const isDragging = ref(false);

    // 转换选项 (使用默认设置)

    // 转换状态和结果
    const isConverting = ref(false);
    const conversionResults = ref([]);
    const convertedCount = ref(0);
    const hasErrors = computed(() =>
      conversionResults.value.some((result) => result.error)
    );

    // 预览相关
    const showMarkdownPreview = ref(false);
    const showFormulasPreview = ref(false);
    const markdownContent = ref("");
    const previewingFile = ref(null);
    const loadingPreview = ref(false);
    const previewError = ref(null);
    const extractedFormulas = ref([]);
    const loadingFormulas = ref(false);
    const formulasError = ref(null);

    // 处理文件选择
    const onFileChange = (event) => {
      const files = Array.from(event.target.files);
      if (files.length > 0) {
        // 检查每个文件的大小
        const oversizedFiles = [];
        const validFiles = [];

        files.forEach((file) => {
          const fileSizeInMB = file.size / (1024 * 1024);
          if (fileSizeInMB > 50) {
            oversizedFiles.push({
              name: file.name,
              size: fileSizeInMB.toFixed(2),
            });
          } else {
            validFiles.push(file);
          }
        });

        // 添加有效文件到选择列表
        if (validFiles.length > 0) {
          selectedFiles.value = [...selectedFiles.value, ...validFiles];
        }

        // 显示错误信息（如果有）
        if (oversizedFiles.length > 0) {
          const errorMessage =
            oversizedFiles.length === 1
              ? `文件 ${oversizedFiles[0].name}（${oversizedFiles[0].size}MB）超过了50MB的限制。`
              : `${oversizedFiles.length} 个文件超过了50MB的限制，已被忽略。`;

          store.dispatch("setError", errorMessage);
        }
      }
    };

    // 处理文件拖放
    const onFileDrop = (event) => {
      isDragging.value = false;
      const files = Array.from(event.dataTransfer.files);

      if (files.length > 0) {
        // 检查每个文件的大小
        const oversizedFiles = [];
        const validFiles = [];

        files.forEach((file) => {
          const fileSizeInMB = file.size / (1024 * 1024);
          if (fileSizeInMB > 50) {
            oversizedFiles.push({
              name: file.name,
              size: fileSizeInMB.toFixed(2),
            });
          } else {
            validFiles.push(file);
          }
        });

        // 添加有效文件到选择列表
        if (validFiles.length > 0) {
          selectedFiles.value = [...selectedFiles.value, ...validFiles];
        }

        // 显示错误信息（如果有）
        if (oversizedFiles.length > 0) {
          const errorMessage =
            oversizedFiles.length === 1
              ? `文件 ${oversizedFiles[0].name}（${oversizedFiles[0].size}MB）超过了50MB的限制。`
              : `${oversizedFiles.length} 个文件超过了50MB的限制，已被忽略。`;

          store.dispatch("setError", errorMessage);
        }
      }
    };

    // 移除单个文件
    const removeFile = (index) => {
      selectedFiles.value.splice(index, 1);
    };

    // 清除所有文件
    const clearFiles = () => {
      selectedFiles.value = [];
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

    // 转换单个文件
    const convertSingleFile = async (file) => {
      try {
        // 创建 FormData 对象
        const formData = new FormData();
        formData.append("file", file);

        // 发送请求
        const response = await axios.post("/api/pdf/convert", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${store.getters["auth/getToken"]}`,
          },
        });

        if (response.data.success) {
          // 添加原始文件名到结果中
          return {
            ...response.data.data,
            originalFilename: file.name,
            error: null,
          };
        } else {
          return {
            originalFilename: file.name,
            error: response.data.message || "转换失败，请稍后重试",
          };
        }
      } catch (error) {
        console.error(`文件 ${file.name} 转换错误:`, error);
        return {
          originalFilename: file.name,
          error: error.response?.data?.message || "转换失败，请稍后重试",
        };
      }
    };

    // 批量转换文件
    const convertFiles = async () => {
      if (selectedFiles.value.length === 0) return;

      isConverting.value = true;
      conversionResults.value = [];
      convertedCount.value = 0;

      try {
        // 逐个转换文件
        for (const file of selectedFiles.value) {
          const result = await convertSingleFile(file);
          conversionResults.value.push(result);
          convertedCount.value++;
        }

        // 显示成功或部分成功的通知
        const successCount = conversionResults.value.filter(
          (r) => !r.error
        ).length;
        const errorCount = conversionResults.value.length - successCount;

        if (errorCount === 0) {
          store.dispatch("setNotification", {
            type: "success",
            message: `所有 ${successCount} 个文件转换成功！`,
          });
        } else if (successCount > 0) {
          store.dispatch("setNotification", {
            type: "warning",
            message: `${successCount} 个文件转换成功，${errorCount} 个文件失败。`,
          });
        } else {
          store.dispatch("setError", "所有文件转换失败，请检查错误信息。");
        }
      } catch (error) {
        console.error("批量转换错误:", error);
        store.dispatch("setError", "批量转换过程中发生错误，请稍后重试。");
      } finally {
        isConverting.value = false;
      }
    };

    // 下载单个文件的所有结果
    const downloadAllResults = (fileId) => {
      const token = store.getters["auth/getToken"];

      // 查找对应的文件信息，以获取原始文件名
      const result = conversionResults.value.find((r) => r.fileId === fileId);
      let fileName = "结果文件.zip";

      // 如果找到文件信息，使用原始文件名
      if (result && result.originalFilename) {
        // 移除扩展名，添加结果文件后缀
        const fileNameWithoutExt = result.originalFilename.replace(
          /\.[^/.]+$/,
          ""
        );
        // 确保文件名不包含非法字符
        const safeFileName = fileNameWithoutExt.replace(/[\\/:*?"<>|]/g, "_");
        fileName = `${safeFileName}_结果文件.zip`;
      }

      // 创建一个临时链接元素
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = `/api/pdf/files/${fileId}/download-all`;

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

    // 批量下载所有选中文件的结果
    const downloadAllSelectedResults = async () => {
      // 获取所有成功转换的文件ID
      const successfulResults = conversionResults.value.filter((r) => !r.error);

      if (successfulResults.length === 0) {
        store.dispatch("setError", "没有可下载的文件");
        return;
      }

      // 如果只有一个文件，直接下载
      if (successfulResults.length === 1) {
        downloadAllResults(successfulResults[0].fileId);
        return;
      }

      store.dispatch("setNotification", {
        type: "info",
        message: "正在准备下载多个文件，请稍候...",
      });

      try {
        // 使用批量下载API
        const token = store.getters["auth/getToken"];
        const fileIds = successfulResults.map((r) => r.fileId);

        // 创建一个隐藏的表单，用于提交POST请求
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/api/pdf/files/batch-download";
        form.style.display = "none";

        // 添加文件ID列表
        const fileIdsInput = document.createElement("input");
        fileIdsInput.name = "fileIds";
        fileIdsInput.value = JSON.stringify(fileIds);
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
        for (const result of successfulResults) {
          await new Promise((resolve) => {
            setTimeout(() => {
              downloadAllResults(result.fileId);
              resolve();
            }, 1000); // 间隔1秒下载，避免浏览器阻止多个下载
          });
        }
      }
    };

    // 预览Markdown内容
    const previewMarkdown = async (result) => {
      if (!result || !result.markdownUrl) return;

      showMarkdownPreview.value = true;
      previewingFile.value = result;
      loadingPreview.value = true;
      previewError.value = null;
      markdownContent.value = "";

      try {
        const response = await axios.get(result.markdownUrl);
        markdownContent.value = response.data;
      } catch (error) {
        console.error("加载Markdown内容错误:", error);
        previewError.value = "加载Markdown内容失败，请稍后重试";
      } finally {
        loadingPreview.value = false;
      }
    };

    // 预览化学式
    const previewFormulas = async (result) => {
      if (!result || !result.formulasUrl) return;

      showFormulasPreview.value = true;
      previewingFile.value = result;
      loadingFormulas.value = true;
      formulasError.value = null;
      extractedFormulas.value = [];

      try {
        const response = await axios.get(result.formulasUrl);
        extractedFormulas.value = response.data || [];
      } catch (error) {
        console.error("加载化学式内容错误:", error);
        formulasError.value = "加载化学式内容失败，请稍后重试";
      } finally {
        loadingFormulas.value = false;
      }
    };

    // 关闭预览
    const closePreview = () => {
      showMarkdownPreview.value = false;
      previewingFile.value = null;
      markdownContent.value = "";
    };

    // 关闭化学式预览
    const closeFormulaPreview = () => {
      showFormulasPreview.value = false;
      previewingFile.value = null;
      extractedFormulas.value = [];
    };

    return {
      // 服务器状态
      serverStatus,
      isTestingConnection,
      testConnection,

      // 文件上传
      selectedFiles,
      isDragging,
      onFileChange,
      onFileDrop,
      formatFileSize,
      removeFile,
      clearFiles,

      // 转换选项已移除 (使用默认设置)

      // 转换状态和结果
      isConverting,
      convertFiles,
      conversionResults,
      convertedCount,
      hasErrors,

      // 预览相关
      showMarkdownPreview,
      showFormulasPreview,
      markdownContent,
      previewingFile,
      loadingPreview,
      previewError,
      extractedFormulas,
      loadingFormulas,
      formulasError,
      previewMarkdown,
      previewFormulas,
      closePreview,
      closeFormulaPreview,

      // 下载相关
      downloadAllResults,
      downloadAllSelectedResults,
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
