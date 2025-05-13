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
                拖放专利目录到此处，或
                <span
                  class="text-blue-600 hover:text-blue-500 cursor-pointer"
                  @click="$refs.dirInput.click()"
                >
                  浏览专利目录
                </span>
              </p>
              <p class="mt-1 text-xs text-gray-500">仅支持专利目录，最大50MB</p>
              <p class="mt-1 text-xs text-gray-500">
                <span class="font-medium">提示：</span>
                可以上传多个文件夹，然后一起处理
              </p>
              <p class="mt-1 text-xs text-gray-500">
                <span class="font-medium">注意：</span>
                专利名将自动使用文件夹名称
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
            <!-- 不再使用单文件上传 -->
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

        <!-- 已上传的文件夹列表 -->
        <div class="mb-8" v-if="uploadedFolders.length > 0">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">
            已上传的文件夹
          </h2>
          <div class="space-y-2">
            <div
              v-for="(folder, index) in uploadedFolders"
              :key="index"
              class="flex items-center justify-between bg-gray-50 p-3 rounded-md"
            >
              <div class="flex items-center">
                <svg
                  class="h-6 w-6 text-blue-500 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  ></path>
                </svg>
                <div>
                  <div class="text-sm font-medium text-gray-900">
                    {{ folder.name }}
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ formatFileSize(folder.size) }}
                  </div>
                </div>
              </div>
              <button
                @click="removeFolder(index)"
                class="text-red-600 hover:text-red-800"
                type="button"
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
        </div>

        <!-- 提交按钮 -->
        <div class="flex justify-between">
          <button
            type="button"
            @click="addMoreFolders"
            :disabled="loading"
            class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg
              class="h-4 w-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              ></path>
            </svg>
            添加更多文件夹
          </button>

          <button
            type="button"
            @click="processUploadedFolders"
            :disabled="uploadedFolders.length === 0 || loading"
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
            {{
              loading
                ? "处理中..."
                : uploadedFolders.length > 1
                ? "批量处理"
                : "处理"
            }}
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
    const uploadedFolders = ref([]);

    // 不再需要专利信息，将使用文件夹名作为专利名
    const patentInfo = reactive({
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

    // 不再需要canSubmit计算属性，因为我们使用uploadedFolders.length来判断是否可以处理

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
      // 不再使用files变量，因为我们只处理目录

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

      // 如果没有目录，显示错误提示
      store.dispatch(
        "setError",
        "化学式提取服务只支持处理专利目录，不支持单个文件"
      );
    };

    // 处理文件选择
    const handleFileChange = (event) => {
      // 清空选择，因为我们不支持单个文件
      event.target.value = null;
      store.dispatch(
        "setError",
        "化学式提取服务只支持处理专利目录，不支持单个文件"
      );
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
        const folderObj = {
          name: dirPath,
          type: "directory",
          size: totalSize,
          files: filesArray,
          hasSubDirs: hasSubDirs,
        };

        // 添加到上传文件夹列表
        uploadedFolders.value.push(folderObj);

        // 清空选择，以便可以再次选择
        event.target.value = null;

        console.log(`目录上传: ${dirPath}, 添加到列表`);
      }
    };

    // 移除文件夹
    const removeFolder = (index) => {
      uploadedFolders.value.splice(index, 1);
    };

    // 添加更多文件夹
    const addMoreFolders = () => {
      document.querySelector("input[webkitdirectory]").click();
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

              // 创建一个表示目录的对象
              const folderObj = {
                name: entry.name,
                type: "directory",
                size: 0, // 无法直接获取总大小
                files: allFiles,
                hasSubDirs: hasSubDirs,
              };

              // 添加到上传文件夹列表
              uploadedFolders.value.push(folderObj);

              console.log(`拖放目录: ${entry.name}, 添加到列表`);
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

    // 处理上传的文件夹
    const processUploadedFolders = async () => {
      if (uploadedFolders.value.length === 0) {
        store.dispatch("setError", "请先上传专利目录");
        return;
      }

      try {
        // 判断是单个处理还是批处理
        const isBatchMode = uploadedFolders.value.length > 1;

        // 创建一个ZIP文件
        const zip = new JSZip();

        // 如果是批处理，将所有文件夹放在一个主目录下
        if (isBatchMode) {
          // 为每个文件夹创建一个子目录
          for (const folder of uploadedFolders.value) {
            for (const file of folder.files) {
              // 获取相对路径
              let relativePath = file.webkitRelativePath || file.fullPath;

              // 确保路径以目录名开头
              if (!relativePath.startsWith(folder.name)) {
                relativePath = `${folder.name}/${relativePath}`;
              }

              // 添加到ZIP
              zip.file(relativePath, file);
            }
          }
        } else {
          // 单个文件夹处理
          const folder = uploadedFolders.value[0];
          for (const file of folder.files) {
            // 获取相对路径
            let relativePath = file.webkitRelativePath || file.fullPath;

            // 确保路径以目录名开头
            if (!relativePath.startsWith(folder.name)) {
              relativePath = `${folder.name}/${relativePath}`;
            }

            // 添加到ZIP
            zip.file(relativePath, file);
          }
        }

        // 生成ZIP文件
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipFileName = isBatchMode
          ? `batch_patents_${new Date().getTime()}.zip`
          : `${uploadedFolders.value[0].name}.zip`;

        const zipFile = new File([zipBlob], zipFileName, {
          type: "application/zip",
        });

        // 创建表单数据
        const formData = new FormData();
        formData.append("patent", zipFile);
        formData.append("isDirectory", "true");
        formData.append("isBatchMode", isBatchMode ? "true" : "false");

        // 使用文件夹名作为专利名
        if (isBatchMode) {
          // 批处理模式下使用批处理名称
          formData.append("title", "批量专利处理");
        } else {
          // 单个文件夹模式下使用文件夹名
          formData.append("title", uploadedFolders.value[0].name);
        }

        // 发送请求
        const response = await store.dispatch(
          "extraction/uploadPatent",
          formData
        );

        if (response.success) {
          // 清空上传列表
          uploadedFolders.value = [];

          // 刷新专利列表
          await store.dispatch("patents/fetchPatents", { limit: 5 });
        }
      } catch (error) {
        console.error("处理上传文件夹失败:", error);
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

    // 旧的上传专利函数已被移除，使用processUploadedFolders替代

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
      uploadedFolders,
      patentInfo,
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
      processPatent,
      deletePatent,
      downloadPatentResults,
      processBatchPatents,
      downloadBatchResults,
      deleteBatchPatents,
      // 新增函数
      removeFolder,
      addMoreFolders,
      processUploadedFolders,
      // 服务器状态相关
      serverStatus,
      isTestingConnection,
      testConnection,
    };
  },
};
</script>
