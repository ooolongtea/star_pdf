<template>
  <div
    class="h-full flex flex-col bg-[#F9F9F9] text-gray-700"
    :class="{ collapsed: collapsed }"
  >
    <!-- 对话列表 -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="p-4 text-center text-gray-600">
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
        class="p-4 text-center text-gray-600"
      >
        暂无对话记录
      </div>

      <div v-else class="space-y-0.5 px-2 py-2">
        <div
          v-for="conversation in conversations"
          :key="conversation.id"
          @click="onSelectConversation(conversation)"
          class="px-3 py-2 rounded cursor-pointer flex items-center justify-between group transition-colors duration-200"
          :class="
            currentConversation && currentConversation.id === conversation.id
              ? 'bg-blue-100 text-gray-800'
              : 'hover:bg-gray-200 text-gray-700'
          "
        >
          <div class="flex items-center overflow-hidden">
            <svg
              class="h-4 w-4 flex-shrink-0"
              :class="{
                'mr-2': !collapsed,
                'text-gray-500': !(
                  currentConversation &&
                  currentConversation.id === conversation.id
                ),
              }"
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
            <span class="truncate text-sm" v-if="!collapsed">{{
              conversation.title
            }}</span>
          </div>

          <div
            class="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <button
              @click.stop="onEditTitle(conversation)"
              class="text-gray-500 hover:text-gray-700 p-1 rounded transition-colors duration-200"
              title="重命名"
            >
              <svg
                class="h-3.5 w-3.5"
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
              class="text-gray-500 hover:text-red-500 p-1 rounded transition-colors duration-200"
              title="删除"
            >
              <svg
                class="h-3.5 w-3.5"
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

    <!-- 编辑标题模态框 - ChatGPT风格 -->
    <div
      v-if="showEditModal"
      class="fixed z-50 inset-0 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div class="flex items-center justify-center min-h-screen p-4">
        <div
          class="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          @click="showEditModal = false"
        ></div>

        <div
          class="relative bg-white rounded-lg overflow-hidden shadow-xl transform transition-all max-w-sm w-full"
        >
          <div class="p-5">
            <h3 class="text-lg font-medium text-gray-900 mb-4" id="modal-title">
              重命名对话
            </h3>
            <input
              type="text"
              v-model="editTitleForm.title"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-900"
              placeholder="输入对话标题"
            />

            <div class="mt-5 flex justify-end space-x-3">
              <button
                type="button"
                @click="showEditModal = false"
                class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none transition-colors duration-200"
              >
                取消
              </button>
              <button
                type="button"
                @click="saveTitle"
                class="px-3 py-2 rounded-md text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 focus:outline-none transition-colors duration-200"
              >
                保存
              </button>
            </div>
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
  name: "ChatSidebar",

  props: {
    collapsed: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["new-chat", "toggle-sidebar"],
  setup(props, { emit }) {
    const store = useStore();

    const showEditModal = ref(false);
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

    // 加载对话列表
    onMounted(async () => {
      await store.dispatch("chat/fetchConversations");
    });

    // 新建对话
    const onNewChat = () => {
      emit("new-chat");
    };

    // 选择对话
    const onSelectConversation = async (conversation) => {
      await store.dispatch("chat/fetchConversation", conversation.id);

      // 选择对话后收起侧边栏，保持与首页一致的动画效果
      emit("toggle-sidebar");
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

    return {
      conversations,
      currentConversation,
      loading,
      showEditModal,
      editTitleForm,
      onNewChat,
      onSelectConversation,
      onEditTitle,
      saveTitle,
      onDeleteConversation,
    };
  },
};
</script>

<style scoped>
/* 自定义滚动条 - ChatGPT风格 */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background-color: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 9999px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.2);
}

/* 收起状态样式 */
.collapsed .overflow-y-auto::-webkit-scrollbar {
  width: 0;
}

.collapsed button {
  padding: 0.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.collapsed .p-4 {
  padding: 0.5rem;
}

.collapsed .px-4 {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

/* 平滑过渡效果 - 与Chat.vue中保持一致 */
.h-full {
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* 对话项悬停效果 */
.px-3.py-2.rounded {
  transition: background-color 0.2s ease;
}
</style>
