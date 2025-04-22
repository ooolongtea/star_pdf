<template>
  <div class="container mx-auto px-4 py-8">
    <div class="bg-white shadow-md rounded-lg overflow-hidden">
      <div class="p-6">
        <h1 class="text-2xl font-bold text-gray-900 mb-6">化学式提取</h1>

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
                拖放文件到此处，或
                <span
                  class="text-blue-600 hover:text-blue-500 cursor-pointer"
                  @click="$refs.fileInput.click()"
                >
                  浏览文件
                </span>
              </p>
              <p class="mt-1 text-xs text-gray-500">支持PDF文件，最大50MB</p>
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
          <button
            type="button"
            @click="uploadPatent"
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
        <h2 class="text-lg font-semibold text-gray-800 mb-4">最近上传的专利</h2>
        <div v-if="patents.length === 0" class="text-center py-8 text-gray-500">
          暂无上传的专利
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
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

export default {
  name: "ExtractionView",
  setup() {
    const store = useStore();
    const router = useRouter();
    const fileInput = ref(null);

    const loading = computed(() => store.getters.isLoading);
    const patents = computed(() => store.getters["patents/getPatents"]);

    const isDragging = ref(false);
    const selectedFile = ref(null);
    const patentInfo = reactive({
      title: "",
      patentNumber: "",
      description: "",
    });

    // 是否可以提交
    const canSubmit = computed(() => {
      return selectedFile.value && patentInfo.title.trim() !== "";
    });

    // 获取专利列表
    onMounted(async () => {
      try {
        await store.dispatch("patents/fetchPatents", { limit: 5 });
      } catch (error) {
        console.error("获取专利列表失败:", error);
      }
    });

    // 处理文件拖放
    const handleFileDrop = (event) => {
      isDragging.value = false;
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type === "application/pdf") {
          selectedFile.value = file;
        } else {
          store.dispatch("setError", "只支持PDF文件");
        }
      }
    };

    // 处理文件选择
    const handleFileChange = (event) => {
      const files = event.target.files;
      if (files.length > 0) {
        selectedFile.value = files[0];
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
    const uploadPatent = async () => {
      if (!canSubmit.value) return;

      try {
        const formData = new FormData();
        formData.append("patent", selectedFile.value);
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
      } catch (error) {
        console.error("删除专利失败:", error);
      }
    };

    return {
      fileInput,
      loading,
      patents,
      isDragging,
      selectedFile,
      patentInfo,
      canSubmit,
      handleFileDrop,
      handleFileChange,
      formatFileSize,
      formatDate,
      getStatusText,
      uploadPatent,
      processPatent,
      deletePatent,
    };
  },
};
</script>
