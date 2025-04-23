<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">API Key管理</h1>

    <div class="bg-white shadow-md rounded-lg overflow-hidden">
      <div class="p-6">
        <div class="mb-6">
          <h3 class="text-lg font-medium text-gray-900">AI模型API密钥</h3>
          <p class="mt-1 text-sm text-gray-500">
            管理您的AI模型API密钥，用于连接不同的AI服务。
          </p>
        </div>

        <!-- API密钥列表 -->
        <div class="mt-6 overflow-hidden border-b border-gray-200 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  模型
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  API密钥
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  API基础URL
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  状态
                </th>
                <th scope="col" class="relative px-6 py-3">
                  <span class="sr-only">操作</span>
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-if="loading">
                <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                  <svg
                    class="animate-spin h-5 w-5 mx-auto text-blue-500"
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
                </td>
              </tr>
              <tr v-else-if="apiKeys.length === 0">
                <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                  暂无API密钥，请添加新的API密钥。
                </td>
              </tr>
              <tr v-for="key in apiKeys" :key="key.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center">
                      <img
                        v-if="key.model_name === 'qwen'"
                        src="https://qianwen-res.oss-cn-beijing.aliyuncs.com/logo_qwen.png"
                        alt="Qwen"
                        class="h-8 w-8"
                      />
                      <img
                        v-else-if="key.model_name === 'deepseek'"
                        src="https://www.deepseek.com/images/logo.svg"
                        alt="DeepSeek"
                        class="h-8 w-8"
                      />
                      <svg
                        v-else
                        class="h-8 w-8 text-gray-400"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"
                        />
                      </svg>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900">
                        {{ getModelDisplayName(key.model_name) }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">
                    {{ maskApiKey(key.api_key) }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">
                    {{ key.api_base_url || '默认' }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="key.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                  >
                    {{ key.is_active ? '启用' : '禁用' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    @click="editApiKey(key)"
                    class="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    编辑
                  </button>
                  <button
                    @click="deleteApiKey(key.id)"
                    class="text-red-600 hover:text-red-900"
                  >
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 添加新API密钥按钮 -->
        <div class="mt-6">
          <button
            @click="showAddModal = true"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg
              class="-ml-1 mr-2 h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                clip-rule="evenodd"
              />
            </svg>
            添加API密钥
          </button>
        </div>
      </div>
    </div>

    <!-- 添加/编辑API密钥模态框 -->
    <div
      v-if="showAddModal"
      class="fixed z-10 inset-0 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
      >
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          @click="showAddModal = false"
        ></div>

        <span
          class="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
          >&#8203;</span
        >

        <div
          class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6"
        >
          <div class="sm:flex sm:items-start">
            <div
              class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10"
            >
              <svg
                class="h-6 w-6 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
              <h3
                class="text-lg leading-6 font-medium text-gray-900"
                id="modal-title"
              >
                {{ editingKey ? '编辑API密钥' : '添加新API密钥' }}
              </h3>
              <div class="mt-4">
                <form @submit.prevent="saveApiKey">
                  <div class="space-y-4">
                    <div>
                      <label
                        for="model"
                        class="block text-sm font-medium text-gray-700"
                      >
                        选择模型
                      </label>
                      <select
                        id="model"
                        v-model="apiKeyForm.model_name"
                        required
                        class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      >
                        <option value="" disabled>请选择模型</option>
                        <option value="qwen">通义千问 (Qwen)</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="baichuan">百川 (Baichuan)</option>
                        <option value="chatglm">智谱 (ChatGLM)</option>
                        <option value="other">其他</option>
                      </select>
                    </div>

                    <div>
                      <label
                        for="api_key"
                        class="block text-sm font-medium text-gray-700"
                      >
                        API密钥
                      </label>
                      <input
                        id="api_key"
                        v-model="apiKeyForm.api_key"
                        type="password"
                        required
                        class="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label
                        for="api_base_url"
                        class="block text-sm font-medium text-gray-700"
                      >
                        API基础URL (可选)
                      </label>
                      <input
                        id="api_base_url"
                        v-model="apiKeyForm.api_base_url"
                        type="text"
                        class="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        placeholder="https://api.example.com/v1"
                      />
                      <p class="mt-1 text-xs text-gray-500">
                        如果不填写，将使用模型默认的API地址
                      </p>
                    </div>

                    <div class="flex items-center">
                      <input
                        id="is_active"
                        v-model="apiKeyForm.is_active"
                        type="checkbox"
                        class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label
                        for="is_active"
                        class="ml-2 block text-sm text-gray-900"
                      >
                        启用此API密钥
                      </label>
                    </div>
                  </div>

                  <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                      type="submit"
                      :disabled="loading"
                      class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
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
                      {{ editingKey ? '更新' : '添加' }}
                    </button>
                    <button
                      type="button"
                      @click="showAddModal = false"
                      class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                    >
                      取消
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from "vue";
import { useStore } from "vuex";

export default {
  name: "ApiKeysView",
  setup() {
    const store = useStore();
    const loading = computed(() => store.getters.isLoading);
    
    const apiKeys = ref([]);
    const showAddModal = ref(false);
    const editingKey = ref(null);
    
    const apiKeyForm = reactive({
      model_name: "",
      api_key: "",
      api_base_url: "",
      is_active: true
    });

    // 获取API密钥列表
    const fetchApiKeys = async () => {
      try {
        const response = await fetch('/api/users/api-keys', {
          headers: {
            'Authorization': `Bearer ${store.getters['auth/getToken']}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            apiKeys.value = data.data.apiKeys;
          }
        }
      } catch (error) {
        console.error('获取API密钥失败:', error);
        store.dispatch('setError', '获取API密钥失败，请稍后重试');
      }
    };

    // 保存API密钥
    const saveApiKey = async () => {
      try {
        store.dispatch('setLoading', true);
        
        const url = editingKey.value 
          ? `/api/users/api-keys/${editingKey.value}` 
          : '/api/users/api-keys';
        
        const method = editingKey.value ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${store.getters['auth/getToken']}`
          },
          body: JSON.stringify(apiKeyForm)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            await fetchApiKeys();
            resetForm();
            showAddModal.value = false;
            store.dispatch('setNotification', {
              type: 'success',
              message: editingKey.value ? 'API密钥已更新' : 'API密钥已添加'
            });
          }
        }
      } catch (error) {
        console.error('保存API密钥失败:', error);
        store.dispatch('setError', '保存API密钥失败，请稍后重试');
      } finally {
        store.dispatch('setLoading', false);
      }
    };

    // 编辑API密钥
    const editApiKey = (key) => {
      editingKey.value = key.id;
      apiKeyForm.model_name = key.model_name;
      apiKeyForm.api_key = ''; // 不显示原密钥
      apiKeyForm.api_base_url = key.api_base_url || '';
      apiKeyForm.is_active = key.is_active;
      showAddModal.value = true;
    };

    // 删除API密钥
    const deleteApiKey = async (id) => {
      if (!confirm('确定要删除此API密钥吗？')) return;
      
      try {
        store.dispatch('setLoading', true);
        
        const response = await fetch(`/api/users/api-keys/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${store.getters['auth/getToken']}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            await fetchApiKeys();
            store.dispatch('setNotification', {
              type: 'success',
              message: 'API密钥已删除'
            });
          }
        }
      } catch (error) {
        console.error('删除API密钥失败:', error);
        store.dispatch('setError', '删除API密钥失败，请稍后重试');
      } finally {
        store.dispatch('setLoading', false);
      }
    };

    // 重置表单
    const resetForm = () => {
      editingKey.value = null;
      apiKeyForm.model_name = "";
      apiKeyForm.api_key = "";
      apiKeyForm.api_base_url = "";
      apiKeyForm.is_active = true;
    };

    // 获取模型显示名称
    const getModelDisplayName = (modelName) => {
      const modelMap = {
        'qwen': '通义千问 (Qwen)',
        'deepseek': 'DeepSeek',
        'baichuan': '百川 (Baichuan)',
        'chatglm': '智谱 (ChatGLM)',
        'other': '其他'
      };
      
      return modelMap[modelName] || modelName;
    };

    // 掩码API密钥
    const maskApiKey = (apiKey) => {
      if (!apiKey) return '';
      if (apiKey.length <= 8) return '********';
      return apiKey.substring(0, 4) + '****' + apiKey.substring(apiKey.length - 4);
    };

    onMounted(() => {
      fetchApiKeys();
    });

    return {
      loading,
      apiKeys,
      showAddModal,
      editingKey,
      apiKeyForm,
      saveApiKey,
      editApiKey,
      deleteApiKey,
      getModelDisplayName,
      maskApiKey
    };
  }
};
</script>
