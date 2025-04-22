<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">仪表盘</h1>

    <!-- 欢迎卡片 -->
    <div class="bg-white shadow-md rounded-lg overflow-hidden mb-8">
      <div class="p-6">
        <h2 class="text-lg font-semibold text-gray-800 mb-2">
          欢迎, {{ user ? user.username : "用户" }}!
        </h2>
        <p class="text-gray-600">
          欢迎使用专利化学式提取系统。这个系统可以帮助您从专利文档中提取化学式和反应信息。
        </p>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white shadow-md rounded-lg overflow-hidden">
        <div class="p-6">
          <div class="flex items-center">
            <div class="p-3 rounded-full bg-blue-100 text-blue-600">
              <svg
                class="h-8 w-8"
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
              <h3 class="text-lg font-semibold text-gray-800">专利数量</h3>
              <p class="text-2xl font-bold text-gray-900">
                {{ stats.patentsCount }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white shadow-md rounded-lg overflow-hidden">
        <div class="p-6">
          <div class="flex items-center">
            <div class="p-3 rounded-full bg-green-100 text-green-600">
              <svg
                class="h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                ></path>
              </svg>
            </div>
            <div class="ml-4">
              <h3 class="text-lg font-semibold text-gray-800">分子数量</h3>
              <p class="text-2xl font-bold text-gray-900">
                {{ stats.moleculesCount }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white shadow-md rounded-lg overflow-hidden">
        <div class="p-6">
          <div class="flex items-center">
            <div class="p-3 rounded-full bg-purple-100 text-purple-600">
              <svg
                class="h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                ></path>
              </svg>
            </div>
            <div class="ml-4">
              <h3 class="text-lg font-semibold text-gray-800">反应数量</h3>
              <p class="text-2xl font-bold text-gray-900">
                {{ stats.reactionsCount }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近的专利 -->
    <div class="bg-white shadow-md rounded-lg overflow-hidden mb-8">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-800">最近的专利</h2>
      </div>
      <div class="p-6">
        <div
          v-if="recentPatents.length === 0"
          class="text-center py-4 text-gray-500"
        >
          暂无专利
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
                <tr v-for="patent in recentPatents" :key="patent.id">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {{ patent.title }}
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
                      class="text-blue-600 hover:text-blue-900"
                    >
                      查看
                    </router-link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="mt-4 flex justify-end">
            <router-link
              to="/extraction"
              class="text-sm text-blue-600 hover:text-blue-800"
            >
              查看全部专利
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近的任务 -->
    <div class="bg-white shadow-md rounded-lg overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-800">最近的任务</h2>
      </div>
      <div class="p-6">
        <div
          v-if="recentTasks.length === 0"
          class="text-center py-4 text-gray-500"
        >
          暂无任务
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
                    专利
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    开始时间
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
                    进度
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="task in recentTasks" :key="task.id">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {{ task.patent_title }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">
                      {{ formatDate(task.start_time) }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                      :class="{
                        'bg-yellow-100 text-yellow-800':
                          task.status === 'pending',
                        'bg-blue-100 text-blue-800': task.status === 'running',
                        'bg-green-100 text-green-800':
                          task.status === 'completed',
                        'bg-red-100 text-red-800': task.status === 'failed',
                      }"
                    >
                      {{ getTaskStatusText(task.status) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        class="bg-blue-600 h-2.5 rounded-full"
                        :style="{ width: `${task.progress}%` }"
                      ></div>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                      {{ Math.round(task.progress) }}% {{ task.message }}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";

export default {
  name: "DashboardView",
  setup() {
    const store = useStore();

    const user = computed(() => store.getters["auth/getUser"]);
    const recentPatents = ref([]);
    const recentTasks = ref([]);
    const stats = ref({
      patentsCount: 0,
      moleculesCount: 0,
      reactionsCount: 0,
    });

    // 获取仪表盘数据
    const fetchDashboardData = async () => {
      try {
        // 获取最近的专利
        const patentsResponse = await store.dispatch("patents/fetchPatents", {
          limit: 5,
        });
        if (patentsResponse.success) {
          recentPatents.value = patentsResponse.data.patents;
        }

        // 获取最近的任务
        const tasksResponse = await store.dispatch("extraction/fetchTasks", {
          limit: 5,
        });
        if (tasksResponse.success) {
          recentTasks.value = tasksResponse.data.tasks;
        }

        // 获取统计数据
        // 这里假设有一个API端点返回统计数据
        // 实际情况可能需要根据后端API调整
        const response = await fetch("/api/dashboard/stats");
        const data = await response.json();
        if (data.success) {
          stats.value = data.data;
        } else {
          // 如果没有专门的统计API，可以使用模拟数据
          stats.value = {
            patentsCount: recentPatents.value.length,
            moleculesCount: 0,
            reactionsCount: 0,
          };
        }
      } catch (error) {
        console.error("获取仪表盘数据失败:", error);
        // 使用模拟数据
        stats.value = {
          patentsCount: recentPatents.value.length,
          moleculesCount: 0,
          reactionsCount: 0,
        };
      }
    };

    // 组件挂载时获取数据
    onMounted(() => {
      fetchDashboardData();
    });

    // 格式化日期
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleString();
    };

    // 获取专利状态文本
    const getStatusText = (status) => {
      const statusMap = {
        pending: "待处理",
        processing: "处理中",
        completed: "已完成",
        failed: "失败",
      };
      return statusMap[status] || status;
    };

    // 获取任务状态文本
    const getTaskStatusText = (status) => {
      const statusMap = {
        pending: "待处理",
        running: "运行中",
        completed: "已完成",
        failed: "失败",
      };
      return statusMap[status] || status;
    };

    return {
      user,
      recentPatents,
      recentTasks,
      stats,
      formatDate,
      getStatusText,
      getTaskStatusText,
    };
  },
};
</script>
