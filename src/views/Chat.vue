<template>
  <div class="h-[calc(100vh)] flex flex-col mt-[50px]">
    <div class="flex-1 flex overflow-hidden">
      <!-- 侧边栏 - 默认收起 -->
      <transition name="sidebar">
        <div
          v-show="!sidebarCollapsed"
          class="h-full flex flex-col bg-[#F9F9F9] w-64 min-w-64 transition-transform duration-500 ease-out absolute z-10"
          @click.stop
        >
          <div class="flex items-center justify-between p-4 h-14 min-h-[56px]">
            <button
              @click="sidebarCollapsed = true"
              class="text-gray-600 hover:text-gray-800 focus:outline-none transition-all duration-200"
              id="sidebar-close-btn"
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
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              </svg>
            </button>
            <button
              @click="createNewChat"
              class="text-gray-600 hover:text-gray-800 focus:outline-none flex items-center transition-all duration-200"
              id="sidebar-new-chat-btn"
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
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                ></path>
              </svg>
            </button>
          </div>

          <ChatSidebar
            @new-chat="createNewChat"
            @toggle-sidebar="sidebarCollapsed = true"
            :collapsed="false"
          />
        </div>
      </transition>

      <!-- 主聊天界面 -->
      <div
        class="flex-1 flex flex-col overflow-hidden transition-transform duration-500 ease-out"
        :class="{ 'translate-x-64': !sidebarCollapsed }"
        style="will-change: transform"
      >
        <!-- 顶部控制栏 - 固定在顶部的主栏 -->
        <div class="flex items-center h-14 min-h-[56px] px-4 border-b">
          <!-- 侧边栏展开/收起触发器 - 仅在侧边栏收起时显示 -->
          <button
            v-show="sidebarCollapsed"
            @click="sidebarCollapsed = !sidebarCollapsed"
            class="p-2 text-gray-700 hover:text-gray-900 focus:outline-none transition-all duration-200"
            id="header-menu-btn"
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
                d="M4 6h16M4 12h16M4 18h16"
              ></path>
            </svg>
          </button>

          <!-- 新建对话图标 - 仅在侧边栏收起时显示 -->
          <button
            v-show="sidebarCollapsed"
            @click="createNewChat"
            class="p-2 ml-2 text-gray-700 hover:text-gray-900 focus:outline-none transition-all duration-200"
            id="header-new-chat-btn"
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
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              ></path>
            </svg>
          </button>

          <!-- AI模型选择器 - 放在顶部栏中 -->
          <div class="flex-1 flex justify-center">
            <div
              v-if="currentConversation"
              class="flex items-center px-3 py-1.5 rounded-lg bg-gray-100 text-sm text-gray-700 hover:bg-gray-200 transition-colors duration-200 cursor-pointer"
            >
              <span
                class="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"
              ></span>
              <span>{{
                getModelDisplayName(currentConversation.model_name)
              }}</span>
              <svg
                class="h-4 w-4 ml-1 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </div>
          </div>
        </div>

        <ChatInterface @new-chat="createNewChat" />
      </div>
    </div>

    <!-- 模型选择弹窗 -->
    <ModelSelectionModal
      v-if="showModelSelectionModal"
      @select="createNewChatWithModel"
      @cancel="cancelCreateNewChat"
    />
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from "vue";
import { useStore } from "vuex";
import ChatSidebar from "../components/chat/ChatSidebar.vue";
import ChatInterface from "../components/chat/ChatInterface.vue";
import ModelSelectionModal from "../components/chat/ModelSelectionModal.vue";

export default {
  name: "ChatView",
  components: {
    ChatSidebar,
    ChatInterface,
    ModelSelectionModal,
  },
  setup() {
    const store = useStore();
    const showSidebar = ref(false); // 移动端侧边栏状态
    const sidebarCollapsed = ref(true); // 默认收起侧边栏
    const showModelSelectionModal = ref(false);

    // 当前选择的模型
    const currentSelectedModel = ref("qwen:qwen-max");

    // 获取当前对话
    const currentConversation = computed(
      () => store.getters["chat/getCurrentConversation"]
    );

    // 监听侧边栏状态变化，优化过渡效果
    watch(sidebarCollapsed, (newValue) => {
      console.log("侧边栏状态变化:", newValue ? "收起" : "展开");

      // 添加一个小延迟，确保DOM更新完成
      if (!newValue) {
        // 侧边栏展开时，确保主内容区域的过渡效果平滑
        document.body.style.overflowX = "hidden";
        setTimeout(() => {
          document.body.style.overflowX = "";
        }, 500);
      } else {
        // 侧边栏收起时，也确保过渡效果平滑
        document.body.style.overflowX = "hidden";
        setTimeout(() => {
          document.body.style.overflowX = "";
        }, 500);
      }
    });

    // 监听侧边栏模型变化
    const onModelChange = (model) => {
      console.log("模型变更：", model);

      // 更新当前选中的模型
      currentSelectedModel.value = model;

      // 如果当前有对话但还没有发送消息，更新对话的模型
      const currentConversation = store.getters["chat/getCurrentConversation"];
      const messages = store.getters["chat/getMessages"];

      console.log("当前对话：", currentConversation);
      console.log("消息数量：", messages.length);

      if (currentConversation && messages.length === 0) {
        console.log("将更新对话模型：", currentConversation.id, model);

        // 添加调试信息
        console.log("当前对话对象:", JSON.stringify(currentConversation));

        // 更新当前对话的模型
        store
          .dispatch("chat/updateConversationModel", {
            id: currentConversation.id,
            model_name: model,
          })
          .then(() => {
            console.log("模型更新成功！");

            // 强制刷新当前对话
            return store.dispatch(
              "chat/fetchConversation",
              currentConversation.id
            );
          })
          .then(() => {
            console.log("刷新当前对话成功！");
            console.log(
              "更新后的对话对象:",
              JSON.stringify(store.getters["chat/getCurrentConversation"])
            );
          })
          .catch((error) => {
            console.error("模型更新失败：", error);
          });
      } else {
        console.log("不更新模型，因为没有当前对话或已有消息");
      }
    };

    // 创建新对话
    const createNewChat = () => {
      // 显示模型选择弹窗
      showModelSelectionModal.value = true;
    };

    // 模型选择完成后创建新对话
    const createNewChatWithModel = async (model) => {
      try {
        console.log("使用模型创建新对话:", model);

        // 更新当前选择的模型
        currentSelectedModel.value = model;

        // 清除当前对话
        store.dispatch("chat/clearCurrentConversation");

        // 创建新对话，使用选择的模型
        await store.dispatch("chat/createConversation", {
          title: "新对话", // 初始标题，将在用户发送第一条消息后自动更新
          model_name: model,
        });

        // 关闭模型选择弹窗
        showModelSelectionModal.value = false;

        // 关闭移动端侧边栏
        showSidebar.value = false;
      } catch (error) {
        console.error("创建新对话失败:", error);
        store.dispatch(
          "setError",
          "创建新对话失败，请确保您已配置相应模型的API密钥"
        );
      }
    };

    // 取消创建新对话
    const cancelCreateNewChat = () => {
      showModelSelectionModal.value = false;
    };

    // 组件挂载后初始化
    onMounted(() => {
      console.log("聊天组件已挂载");
    });

    // 获取模型显示名称
    const getModelDisplayName = (modelName) => {
      if (!modelName) return "未知模型";

      // 从模型名称中提取提供商和模型名称
      const parts = modelName.split(":");
      if (parts.length < 2) return modelName;

      const provider = parts[0];
      const model = parts[1];

      // 根据提供商和模型名称返回友好的显示名称
      if (provider === "qwen") {
        if (model.includes("max")) return "通义千问-Max";
        if (model.includes("plus")) return "通义千问-Plus";
        if (model.includes("turbo")) return "通义千问-Turbo";
        if (model.includes("vl")) return "通义千问-VL";
        if (model.includes("7b")) return "通义千问-7B";
        if (model.includes("32b")) return "通义千问-32B";
        if (model.includes("72b")) return "通义千问-72B";
        if (model.includes("qwen3")) {
          if (model.includes("235b")) return "通义千问3-235B";
          if (model.includes("72b")) return "通义千问3-72B";
          if (model.includes("32b")) return "通义千问3-32B";
          if (model.includes("7b")) return "通义千问3-7B";
          if (model.includes("4b")) return "通义千问3-4B";
          if (model.includes("1.8b")) return "通义千问3-1.8B";
          return "通义千问3";
        }
        if (model.includes("qwq")) return "QwQ-Plus";
        return `通义千问-${model}`;
      }

      if (provider === "deepseek") {
        if (model.includes("coder")) return "DeepSeek-Coder";
        if (model.includes("reasoner")) return "DeepSeek-Reasoner";
        if (model.includes("moe")) return "DeepSeek-MoE";
        return `DeepSeek-${model}`;
      }

      return modelName;
    };

    return {
      showSidebar,
      sidebarCollapsed,
      showModelSelectionModal,
      currentSelectedModel,
      currentConversation,
      createNewChat,
      createNewChatWithModel,
      cancelCreateNewChat,
      onModelChange,
      getModelDisplayName,
    };
  },
};
</script>

<style scoped>
/* 现代化过渡效果 */
.shadow-sm {
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

/* 流畅动画效果 */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  transition-duration: 500ms;
}

/* 定义字体 */
.h-screen {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  color: #333;
}

/* 侧边栏过渡动画 - 更平滑的动画效果，只在水平方向移动 */
.sidebar-enter-active {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.sidebar-leave-active {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.sidebar-enter-from,
.sidebar-leave-to {
  transform: translateX(-100%);
}

/* 确保侧边栏和主内容区域无缝衔接 */
.h-full.flex.flex-col.bg-\[\#F9F9F9\] {
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
  border-right: none;
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* 控制按钮过渡效果 */
#header-menu-btn,
#header-new-chat-btn,
#sidebar-close-btn,
#sidebar-new-chat-btn {
  transition: all 0.2s ease-in-out;
}

#header-menu-btn:hover,
#header-new-chat-btn:hover,
#sidebar-close-btn:hover,
#sidebar-new-chat-btn:hover {
  transform: scale(1.05);
}

/* 主内容区域过渡 - 使用transform替代margin，避免抖动，进一步减小移动幅度 */
.translate-x-64 {
  transform: translateX(3rem);
}

/* 移除不必要的边框 */
.border-r,
.border-t {
  border: none !important;
}

/* 保留顶部栏的底部边框，但使其更加柔和 */
.border-b {
  border-bottom-width: 1px;
}

/* 确保顶部栏高度一致 */
.h-14 {
  height: 56px !important;
  min-height: 56px !important;
}
</style>
