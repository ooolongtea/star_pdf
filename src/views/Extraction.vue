<template>
  <div class="container mx-auto px-4 py-8">
    <div class="bg-white shadow-md rounded-lg overflow-hidden">
      <div class="p-6">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold text-gray-900">化学式提取</h1>

          <!-- 服务器状态指示器 -->
          <div class="flex items-center">
            <div
              class="w-3 h-3 rounded-full mr-2"
              :class="serverStatus.connected ? 'bg-green-500' : 'bg-red-500'"
            ></div>
            <span class="text-sm mr-3"
              >服务器状态: {{ serverStatus.message }}</span
            >
            <button
              @click="testConnection"
              class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 focus:outline-none"
              :disabled="isTestingConnection"
            >
              <span v-if="isTestingConnection">测试中...</span>
              <span v-else>测试连接</span>
            </button>
          </div>
        </div>

        <!-- 上传区域 -->
        <div class="mb-8">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">上传专利文件</h2>
          <div
            class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center"
            :class="{ 'border-blue-500 bg-blue-50': isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleFileDrop"
          >
            <div v-if="!selectedFile">
              <svg
                class="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                ></path>
              </svg>
              <p class="mt-2 text-sm text-gray-600">
                拖放文件或目录到此处，或
                <span
                  class="text-blue-600 hover:text-blue-500 cursor-pointer mr-2"
                  @click="$refs.fileInput.click()"
                >
                  浏览文件
                </span>
                <span
                  class="text-blue-600 hover:text-blue-500 cursor-pointer"
                  @click="$refs.dirInput.click()"
                >
                  浏览目录
                </span>
              </p>
              <p class="mt-1 text-xs text-gray-500">
                支持PDF文件或专利目录，最大50MB
              </p>
              <p class="mt-1 text-xs text-gray-500">
                <span class="font-medium">提示：</span>
                上传单个专利目录时不使用批处理模式，上传包含多个专利的目录时使用批处理模式
              </p>
            </div>
            <div v-else class="text-left">
              <div class="flex items-center">
                <svg
                  class="h-8 w-8 text-blue-500"
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
                <div class="ml-4 flex-1">
                  <div class="text-sm font-medium text-gray-900">
                    {{ selectedFile.name }}
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ formatFileSize(selectedFile.size) }}
                  </div>
                </div>
                <button
                  type="button"
                  class="text-red-600 hover:text-red-800"
                  @click="selectedFile = null"
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
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept="application/pdf"
              class="hidden"
              @change="handleFileChange"
            />
            <input
              ref="dirInput"
              type="file"
              webkitdirectory
              directory
              multiple
              class="hidden"
              @change="handleDirChange"
            />
          </div>
        </div>

        <!-- 专利信息表单 -->
        <div class="mb-8" v-if="selectedFile">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">专利信息</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                for="title"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                专利标题 <span class="text-red-500">*</span>
              </label>
              <input
                id="title"
                v-model="patentInfo.title"
                type="text"
                required
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="输入专利标题"
              />
            </div>
            <div>
              <label
                for="patentNumber"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                专利号
              </label>
              <input
                id="patentNumber"
                v-model="patentInfo.patentNumber"
                type="text"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="输入专利号（可选）"
              />
            </div>
            <div class="md:col-span-2">
              <label
                for="description"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                描述
              </label>
              <textarea
                id="description"
                v-model="patentInfo.description"
                rows="3"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="输入专利描述（可选）"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- 提交按钮 -->
        <div class="flex justify-end">
          <!-- 目录上传时显示两个按钮 -->
          <div
            v-if="selectedFile && selectedFile.type === 'directory'"
            class="flex space-x-2"
          >
            <button
              type="button"
              @click="uploadPatent(false)"
              :disabled="!canSubmit || loading"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              <svg
                v-if="loading"
                class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
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
              {{ loading ? "上传中..." : "作为单个专利处理" }}
            </button>
            <button
              type="button"
              @click="uploadPatent(true)"
              :disabled="!canSubmit || loading"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
            >
              <svg
                v-if="loading"
                class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
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
              {{ loading ? "上传中..." : "作为多个专利批处理" }}
            </button>
          </div>
          <!-- 单文件上传时显示一个按钮 -->
          <button
            v-else
            type="button"
            @click="uploadPatent(false)"
            :disabled="!canSubmit || loading"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <svg
              v-if="loading"
              class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
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
            {{ loading ? "上传中..." : "上传并提取" }}
          </button>
        </div>
      </div>
    </div>

    <!-- 最近上传的专利 -->
    <div class="mt-8 bg-white shadow-md rounded-lg overflow-hidden">
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-800">最近上传的专利</h2>

          <!-- 批量操作按钮 -->
          <div v-if="selectedPatents.length > 0" class="flex space-x-2">
            <button
              @click="processBatchPatents"
              class="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              批量处理 ({{ selectedPatents.length }})
            </button>
            <button
              @click="downloadBatchResults"
              class="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              批量下载 ({{ selectedPatents.length }})
            </button>
            <button
              @click="deleteBatchPatents"
              class="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              批量删除 ({{ selectedPatents.length }})
            </button>
          </div>
        </div>

        <div v-if="patents.length === 0" class="text-center py-8 text-gray-500">
          暂无上传的专利
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    :checked="isAllSelected"
                    @change="toggleSelectAll"
                  />
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  标题
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  专利号
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  上传时间
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  状态
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="patent in patents" :key="patent.id">
                <td class="px-4 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    :checked="isPatentSelected(patent.id)"
                    @change="togglePatentSelection(patent.id)"
                  />
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">
                    {{ patent.title }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-500">
                    {{ patent.patent_number || "无" }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-500">
                    {{ formatDate(patent.created_at) }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="{
                      'bg-yellow-100 text-yellow-800':
                        patent.status === 'pending',
                      'bg-blue-100 text-blue-800':
                        patent.status === 'processing',
                      'bg-green-100 text-green-800':
                        patent.status === 'completed',
                      'bg-red-100 text-red-800': patent.status === 'failed',
                    }"
                  >
                    {{ getStatusText(patent.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <router-link
                    :to="`/patents/${patent.id}`"
                    class="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    查看
                  </router-link>
                  <button
                    v-if="
                      patent.status === 'pending' || patent.status === 'failed'
                    "
                    @click="processPatent(patent.id)"
                    class="text-green-600 hover:text-green-900 mr-3"
                  >
                    处理
                  </button>
                  <button
                    v-if="patent.status === 'completed'"
                    @click="downloadPatentResults(patent.id, patent.title)"
                    class="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    下载
                  </button>
                  <button
                    @click="deletePatent(patent.id)"
                    class="text-red-600 hover:text-red-900"
                  >
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import JSZip from "jszip";
import axios from "axios";

export default {
  name: "ExtractionView",
  setup() {
    const store = useStore();
    const router = useRouter();
    const fileInput = ref(null);

    const loading = computed(() => store.getters.isLoading);
    const patents = computed(() => store.getters["patents/getPatents"]);

    // 服务器状态
    const serverStatus = ref({
      connected: false,
      message: "未连接",
    });
    const isTestingConnection = ref(false);

    // 测试与化学式提取服务器的连接
    const testConnection = async () => {
      if (isTestingConnection.value) return;

      isTestingConnection.value = true;
      serverStatus.value = {
        connected: false,
        message: "连接中...",
      };

      try {
        const response = await axios.get("/api/extraction/test-connection", {
          headers: {
            Authorization: `Bearer ${store.getters["auth/getToken"]}`,
          },
        });

        if (response.data.success) {
          serverStatus.value = {
            connected: true,
            message: "已连接",
          };
          console.log("化学式提取服务器连接成功:", response.data);
        } else {
          serverStatus.value = {
            connected: false,
            message: "连接失败",
          };
          console.error("化学式提取服务器连接失败:", response.data.message);
        }
      } catch (error) {
        serverStatus.value = {
          connected: false,
          message:
            "连接失败: " + (error.response?.data?.message || error.message),
        };
        console.error("化学式提取服务器连接测试错误:", error);
      } finally {
        isTestingConnection.value = false;
      }
    };

    const isDragging = ref(false);
    const selectedFile = ref(null);
    const selectedPatents = ref([]);
    const patentInfo = reactive({
      title: "",
      patentNumber: "",
      description: "",
      isDirectory: false,
      isBatchMode: false,
    });

    // 是否全选
    const isAllSelected = computed(() => {
      return (
        patents.value.length > 0 &&
        selectedPatents.value.length === patents.value.length
      );
    });

    // 检查专利是否被选中
    const isPatentSelected = (patentId) => {
      return selectedPatents.value.includes(patentId);
    };

    // 切换专利选择状态
    const togglePatentSelection = (patentId) => {
      const index = selectedPatents.value.indexOf(patentId);
      if (index === -1) {
        selectedPatents.value.push(patentId);
      } else {
        selectedPatents.value.splice(index, 1);
      }
    };

    // 切换全选状态
    const toggleSelectAll = () => {
      if (isAllSelected.value) {
        selectedPatents.value = [];
      } else {
        selectedPatents.value = patents.value.map((patent) => patent.id);
      }
    };

    // 是否可以提交
    const canSubmit = computed(() => {
      return selectedFile.value && patentInfo.title.trim() !== "";
    });

    // 获取专利列表并测试连接
    onMounted(async () => {
      try {
        await store.dispatch("patents/fetchPatents", { limit: 5 });
        // 自动测试连接
        testConnection();
      } catch (error) {
        console.error("获取专利列表失败:", error);
      }
    });

    // 处理文件拖放
    const handleFileDrop = (event) => {
      isDragging.value = false;
      const items = event.dataTransfer.items;
      const files = event.dataTransfer.files;

      // 检查是否有目录
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.webkitGetAsEntry && item.webkitGetAsEntry().isDirectory) {
            // 是目录，需要特殊处理
            const entry = item.webkitGetAsEntry();
            handleDirectoryEntry(entry);
            return;
          }
        }
      }

      // 如果没有目录，处理文件
      if (files.length > 0) {
        const file = files[0];
        if (file.type === "application/pdf") {
          selectedFile.value = file;
          patentInfo.isDirectory = false;
          patentInfo.isBatchMode = false;
        } else {
          store.dispatch("setError", "只支持PDF文件或专利目录");
        }
      }
    };

    // 处理文件选择
    const handleFileChange = (event) => {
      const files = event.target.files;
      if (files.length > 0) {
        selectedFile.value = files[0];
        patentInfo.isDirectory = false;
        patentInfo.isBatchMode = false;
      }
    };

    // 处理目录选择
    const handleDirChange = (event) => {
      const files = event.target.files;
      if (files.length > 0) {
        // 创建一个虚拟的目录文件对象
        const dirPath = files[0].webkitRelativePath.split("/")[0];

        // 检查是否包含子目录（判断批处理模式）
        let hasSubDirs = false;
        const dirPaths = new Set();

        for (let i = 0; i < files.length; i++) {
          const pathParts = files[i].webkitRelativePath.split("/");
          if (pathParts.length > 2) {
            // 如果路径深度大于2，说明有子目录
            dirPaths.add(pathParts[1]);
            if (dirPaths.size > 1) {
              hasSubDirs = true;
              break;
            }
          }
        }

        // 将FileList转换为数组
        const filesArray = Array.from(files);

        // 计算总大小
        const totalSize = filesArray.reduce(
          (total, file) => total + file.size,
          0
        );

        // 创建一个表示目录的对象
        selectedFile.value = {
          name: dirPath,
          type: "directory",
          size: totalSize,
          files: filesArray,
        };

        patentInfo.isDirectory = true;
        patentInfo.isBatchMode = hasSubDirs;

        console.log(`目录上传: ${dirPath}, 批处理模式: ${hasSubDirs}`);
      }
    };

    // 处理目录条目
    const handleDirectoryEntry = (entry) => {
      if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const allFiles = [];

        // 递归读取目录内容
        const readEntries = () => {
          dirReader.readEntries((entries) => {
            if (entries.length === 0) {
              // 目录读取完成
              // 创建一个表示目录的对象
              selectedFile.value = {
                name: entry.name,
                type: "directory",
                size: 0, // 无法直接获取总大小
                files: allFiles,
              };

              // 检查是否有子目录（判断批处理模式）
              const dirPaths = new Set();
              let hasSubDirs = false;

              for (const file of allFiles) {
                const pathParts = file.fullPath.split("/");
                if (pathParts.length > 2) {
                  dirPaths.add(pathParts[1]);
                  if (dirPaths.size > 1) {
                    hasSubDirs = true;
                    break;
                  }
                }
              }

              patentInfo.isDirectory = true;
              patentInfo.isBatchMode = hasSubDirs;

              console.log(`拖放目录: ${entry.name}, 批处理模式: ${hasSubDirs}`);
            } else {
              // 继续读取目录
              for (let i = 0; i < entries.length; i++) {
                const entryItem = entries[i];
                if (entryItem.isFile) {
                  entryItem.file((file) => {
                    file.fullPath = entryItem.fullPath;
                    allFiles.push(file);
                  });
                } else if (entryItem.isDirectory) {
                  // 递归处理子目录
                  handleDirectoryEntry(entryItem);
                }
              }
              readEntries(); // 继续读取
            }
          });
        };

        readEntries();
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

    // 格式化日期
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleString();
    };

    // 获取状态文本
    const getStatusText = (status) => {
      const statusMap = {
        pending: "待处理",
        processing: "处理中",
        completed: "已完成",
        failed: "失败",
      };
      return statusMap[status] || status;
    };

    // 上传专利
    const uploadPatent = async (isBatchMode = false) => {
      if (!canSubmit.value) return;

      try {
        const formData = new FormData();

        // 处理不同类型的上传
        if (patentInfo.isDirectory) {
          // 目录上传
          console.log(
            `上传目录: ${selectedFile.value.name}, 批处理模式: ${isBatchMode}`
          );

          // 创建一个ZIP文件
          const zip = new JSZip();

          // 添加所有文件到ZIP
          // 确保files是数组
          const filesArray = Array.isArray(selectedFile.value.files)
            ? selectedFile.value.files
            : Array.from(selectedFile.value.files);

          for (const file of filesArray) {
            // 获取相对路径
            let relativePath = file.webkitRelativePath || file.fullPath;
            // 确保路径以目录名开头
            if (!relativePath.startsWith(selectedFile.value.name)) {
              relativePath = `${selectedFile.value.name}/${relativePath}`;
            }

            // 添加到ZIP
            zip.file(relativePath, file);
          }

          // 生成ZIP文件
          const zipBlob = await zip.generateAsync({ type: "blob" });
          const zipFile = new File(
            [zipBlob],
            `${selectedFile.value.name}.zip`,
            { type: "application/zip" }
          );

          // 添加到表单
          formData.append("patent", zipFile);
          formData.append("isDirectory", "true");
          formData.append("isBatchMode", isBatchMode ? "true" : "false");
        } else {
          // 单文件上传
          formData.append("patent", selectedFile.value);
          formData.append("isDirectory", "false");
          formData.append("isBatchMode", "false");
        }

        // 添加其他信息
        formData.append("title", patentInfo.title);
        formData.append("patentNumber", patentInfo.patentNumber);
        formData.append("description", patentInfo.description);

        const response = await store.dispatch(
          "extraction/uploadPatent",
          formData
        );

        if (response.success) {
          // 重置表单
          selectedFile.value = null;
          patentInfo.title = "";
          patentInfo.patentNumber = "";
          patentInfo.description = "";
          patentInfo.isDirectory = false;
          patentInfo.isBatchMode = false;

          // 刷新专利列表
          await store.dispatch("patents/fetchPatents", { limit: 5 });
        }
      } catch (error) {
        console.error("上传专利失败:", error);
      }
    };

    // 处理专利
    const processPatent = async (patentId) => {
      try {
        const response = await store.dispatch(
          "extraction/processPatent",
          patentId
        );

        if (response.success) {
          // 跳转到专利详情页
          router.push(`/patents/${patentId}`);
        }
      } catch (error) {
        console.error("处理专利失败:", error);
      }
    };

    // 删除专利
    const deletePatent = async (patentId) => {
      if (!confirm("确定要删除此专利吗？此操作不可撤销。")) {
        return;
      }

      try {
        await store.dispatch("patents/deletePatent", patentId);
        // 从选中列表中移除
        const index = selectedPatents.value.indexOf(patentId);
        if (index !== -1) {
          selectedPatents.value.splice(index, 1);
        }
      } catch (error) {
        console.error("删除专利失败:", error);
      }
    };

    // 下载专利结果
    const downloadPatentResults = async (patentId, patentTitle) => {
      try {
        await store.dispatch("patents/downloadPatentResults", {
          patentId,
          fileName: `${patentTitle}_results.zip`,
        });
      } catch (error) {
        console.error("下载专利结果失败:", error);
      }
    };

    // 批量处理专利
    const processBatchPatents = async () => {
      if (selectedPatents.value.length === 0) {
        store.dispatch("setError", "请选择要处理的专利");
        return;
      }

      if (
        !confirm(
          `确定要批量处理选中的 ${selectedPatents.value.length} 个专利吗？`
        )
      ) {
        return;
      }

      try {
        await store.dispatch(
          "patents/processBatchPatents",
          selectedPatents.value
        );
        store.dispatch("setNotification", {
          type: "success",
          message: "批量处理任务已提交",
        });
      } catch (error) {
        console.error("批量处理专利失败:", error);
      }
    };

    // 批量下载结果
    const downloadBatchResults = async () => {
      if (selectedPatents.value.length === 0) {
        store.dispatch("setError", "请选择要下载的专利");
        return;
      }

      try {
        // 获取选中的专利详情
        const selectedPatentDetails = patents.value.filter(
          (patent) =>
            selectedPatents.value.includes(patent.id) &&
            patent.status === "completed"
        );

        if (selectedPatentDetails.length === 0) {
          store.dispatch("setError", "选中的专利中没有已完成处理的专利");
          return;
        }

        await store.dispatch("patents/downloadBatchResults", {
          patentIds: selectedPatentDetails.map((p) => p.id),
          fileName: `batch_results_${new Date().getTime()}.zip`,
        });
      } catch (error) {
        console.error("批量下载结果失败:", error);
      }
    };

    // 批量删除专利
    const deleteBatchPatents = async () => {
      if (selectedPatents.value.length === 0) {
        store.dispatch("setError", "请选择要删除的专利");
        return;
      }

      if (
        !confirm(
          `确定要删除选中的 ${selectedPatents.value.length} 个专利吗？此操作不可撤销。`
        )
      ) {
        return;
      }

      try {
        await store.dispatch(
          "patents/deleteBatchPatents",
          selectedPatents.value
        );
        // 清空选中列表
        selectedPatents.value = [];
      } catch (error) {
        console.error("批量删除专利失败:", error);
      }
    };

    return {
      fileInput,
      loading,
      patents,
      isDragging,
      selectedFile,
      selectedPatents,
      patentInfo,
      canSubmit,
      isAllSelected,
      isPatentSelected,
      togglePatentSelection,
      toggleSelectAll,
      handleFileDrop,
      handleFileChange,
      handleDirChange,
      formatFileSize,
      formatDate,
      getStatusText,
      uploadPatent,
      processPatent,
      deletePatent,
      downloadPatentResults,
      processBatchPatents,
      downloadBatchResults,
      deleteBatchPatents,
      // 服务器状态相关
      serverStatus,
      isTestingConnection,
      testConnection,
    };
  },
};
</script>
