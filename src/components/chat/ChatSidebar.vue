<template>
  <div class="h-full flex flex-col bg-white text-gray-800">
    <!-- 新建对话按钮 -->
    <div class="p-4 border-b border-gray-200">
      <button
        @click="onNewChat"
        class="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
      >
        <svg
          class="h-5 w-5 mr-2"
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
        新建对话
      </button>
    </div>

    <!-- 模型选择器 -->
    <div class="px-4 mb-4 pt-4">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <ModelSelector
            v-model="selectedModel"
            :options="modelOptions"
            @change="onModelChange"
          />
        </div>
        <button
          @click="showModelPanel = true"
          class="ml-2 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none"
          title="高级模型选择"
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
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            ></path>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            ></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- 对话列表 -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="p-4 text-center text-gray-400">
        <svg
          class="animate-spin h-5 w-5 mx-auto mb-2"
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
        加载中...
      </div>

      <div
        v-else-if="conversations.length === 0"
        class="p-4 text-center text-gray-400"
      >
        暂无对话记录
      </div>

      <div v-else class="space-y-1 px-2">
        <div
          v-for="conversation in conversations"
          :key="conversation.id"
          @click="onSelectConversation(conversation)"
          class="p-2 rounded-md cursor-pointer flex items-center justify-between group"
          :class="
            currentConversation && currentConversation.id === conversation.id
              ? 'bg-gray-100 text-gray-900'
              : 'hover:bg-gray-50 text-gray-700'
          "
        >
          <div class="flex items-center overflow-hidden">
            <svg
              class="h-5 w-5 mr-2 flex-shrink-0 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              ></path>
            </svg>
            <span class="truncate">{{ conversation.title }}</span>
          </div>

          <div
            class="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <button
              @click.stop="onEditTitle(conversation)"
              class="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100"
              title="重命名"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                ></path>
              </svg>
            </button>

            <button
              @click.stop="onDeleteConversation(conversation)"
              class="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-gray-100"
              title="删除"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                ></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑标题模态框 -->
    <div
      v-if="showEditModal"
      class="fixed z-10 inset-0 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
      >
        <div
          class="fixed inset-0 bg-gray-600 bg-opacity-50 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          @click="showEditModal = false"
        ></div>

        <span
          class="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
          >&#8203;</span
        >

        <div
          class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
        >
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3
                  class="text-lg leading-6 font-medium text-gray-900"
                  id="modal-title"
                >
                  重命名对话
                </h3>
                <div class="mt-2">
                  <input
                    type="text"
                    v-model="editTitleForm.title"
                    class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="输入对话标题"
                  />
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              @click="saveTitle"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              保存
            </button>
            <button
              type="button"
              @click="showEditModal = false"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 模型选择面板 -->
    <div
      v-if="showModelPanel"
      class="fixed inset-0 z-20 overflow-y-auto"
      aria-labelledby="model-panel-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center"
      >
        <div
          class="fixed inset-0 bg-gray-600 bg-opacity-50 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          @click="showModelPanel = false"
        ></div>

        <div
          class="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
        >
          <ModelSelectorPanel
            v-model="selectedModel"
            :options="modelOptions"
            @change="onModelChange"
            @close="showModelPanel = false"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";
import ModelSelector from "./ModelSelector.vue";
import ModelSelectorPanel from "./ModelSelectorPanel.vue";

export default {
  name: "ChatSidebar",
  components: {
    ModelSelector,
    ModelSelectorPanel,
  },
  emits: ["new-chat"],
  setup(props, { emit }) {
    const store = useStore();

    const selectedModel = ref("qwen");
    const showEditModal = ref(false);
    const showModelPanel = ref(false);
    const editTitleForm = ref({
      id: null,
      title: "",
    });

    // 从Vuex获取数据
    const conversations = computed(
      () => store.getters["chat/getConversations"]
    );
    const currentConversation = computed(
      () => store.getters["chat/getCurrentConversation"]
    );
    const loading = computed(() => store.getters["chat/isLoading"]);
    const modelOptions = computed(() => store.getters["chat/getModelOptions"]);

    // 加载对话列表
    onMounted(async () => {
      await store.dispatch("chat/fetchConversations");
    });

    // 新建对话
    const onNewChat = () => {
      emit("new-chat", selectedModel.value);
    };

    // 选择对话
    const onSelectConversation = async (conversation) => {
      await store.dispatch("chat/fetchConversation", conversation.id);
    };

    // 编辑对话标题
    const onEditTitle = (conversation) => {
      editTitleForm.value = {
        id: conversation.id,
        title: conversation.title,
      };
      showEditModal.value = true;
    };

    // 保存标题
    const saveTitle = async () => {
      if (!editTitleForm.value.title.trim()) return;

      await store.dispatch("chat/updateConversationTitle", {
        id: editTitleForm.value.id,
        title: editTitleForm.value.title,
      });

      showEditModal.value = false;
    };

    // 删除对话
    const onDeleteConversation = async (conversation) => {
      if (!confirm(`确定要删除对话 "${conversation.title}" 吗？`)) return;

      await store.dispatch("chat/deleteConversation", conversation.id);
    };

    // 模型变更
    const onModelChange = (model) => {
      selectedModel.value = model;
    };

    return {
      conversations,
      currentConversation,
      loading,
      selectedModel,
      modelOptions,
      showEditModal,
      showModelPanel,
      editTitleForm,
      onNewChat,
      onSelectConversation,
      onEditTitle,
      saveTitle,
      onDeleteConversation,
      onModelChange,
    };
  },
};
</script>

<style scoped>
/* 自定义滚动条 */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  @apply bg-gray-100;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  @apply bg-gray-300 rounded;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400;
}
</style>
