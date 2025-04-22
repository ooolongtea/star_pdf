<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">提取结果</h1>

    <!-- 过滤和排序选项 -->
    <div class="bg-white shadow-md rounded-lg overflow-hidden mb-8">
      <div class="p-6">
        <div
          class="flex flex-col md:flex-row md:items-center md:justify-between"
        >
          <div class="mb-4 md:mb-0">
            <label
              for="status-filter"
              class="block text-sm font-medium text-gray-700 mb-1"
            >
              状态过滤
            </label>
            <select
              id="status-filter"
              v-model="filters.status"
              class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">全部状态</option>
              <option value="pending">待处理</option>
              <option value="processing">处理中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
            </select>
          </div>

          <div>
            <label
              for="sort-by"
              class="block text-sm font-medium text-gray-700 mb-1"
            >
              排序方式
            </label>
            <select
              id="sort-by"
              v-model="sortBy"
              class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="created_at">上传时间</option>
              <option value="title">标题</option>
              <option value="status">状态</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- 专利列表 -->
    <div class="bg-white shadow-md rounded-lg overflow-hidden">
      <div class="p-6">
        <div v-if="loading" class="flex justify-center items-center py-12">
          <svg
            class="animate-spin h-10 w-10 text-blue-500"
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
        </div>

        <div
          v-else-if="patents.length === 0"
          class="text-center py-12 text-gray-500"
        >
          暂无专利数据
        </div>

        <div v-else>
          <div class="overflow-x-auto">
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
                    分子数量
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    反应数量
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
                <tr v-for="patent in sortedPatents" :key="patent.id">
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
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">
                      {{ patent.molecules_count || 0 }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">
                      {{ patent.reactions_count || 0 }}
                    </div>
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
                        patent.status === 'pending' ||
                        patent.status === 'failed'
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

          <!-- 分页 -->
          <div class="mt-6 flex justify-between items-center">
            <div class="text-sm text-gray-700">
              显示
              <span class="font-medium">{{
                (pagination.page - 1) * pagination.limit + 1
              }}</span>
              到
              <span class="font-medium">{{
                Math.min(pagination.page * pagination.limit, pagination.total)
              }}</span>
              条， 共 <span class="font-medium">{{ pagination.total }}</span> 条
            </div>
            <div class="flex space-x-2">
              <button
                @click="changePage(pagination.page - 1)"
                :disabled="pagination.page <= 1"
                class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                @click="changePage(pagination.page + 1)"
                :disabled="pagination.page >= pagination.pages"
                class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";

export default {
  name: "ResultsView",
  setup() {
    const store = useStore();
    const router = useRouter();

    const loading = computed(() => store.getters.isLoading);
    const patents = computed(() => store.getters["patents/getPatents"]);
    const pagination = computed(() => store.getters["patents/getPagination"]);

    const filters = reactive({
      status: "",
    });

    const sortBy = ref("created_at");

    // 排序后的专利列表
    const sortedPatents = computed(() => {
      return [...patents.value].sort((a, b) => {
        if (sortBy.value === "created_at") {
          return new Date(b.created_at) - new Date(a.created_at);
        } else if (sortBy.value === "title") {
          return a.title.localeCompare(b.title);
        } else if (sortBy.value === "status") {
          const statusOrder = {
            processing: 1,
            pending: 2,
            completed: 3,
            failed: 4,
          };
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return 0;
      });
    });

    // 获取专利列表
    const fetchPatents = async (page = 1) => {
      try {
        const params = {
          page,
          limit: 10,
        };

        if (filters.status) {
          params.status = filters.status;
        }

        await store.dispatch("patents/fetchPatents", params);
      } catch (error) {
        console.error("获取专利列表失败:", error);
      }
    };

    // 监听过滤器变化
    watch(filters, () => {
      fetchPatents(1);
    });

    // 组件挂载时获取专利列表
    onMounted(() => {
      fetchPatents();
    });

    // 切换页码
    const changePage = (page) => {
      if (page < 1 || page > pagination.value.pages) return;
      fetchPatents(page);
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
        // 刷新列表
        fetchPatents(pagination.value.page);
      } catch (error) {
        console.error("删除专利失败:", error);
      }
    };

    return {
      loading,
      patents,
      pagination,
      filters,
      sortBy,
      sortedPatents,
      changePage,
      formatDate,
      getStatusText,
      processPatent,
      deletePatent,
    };
  },
};
</script>
