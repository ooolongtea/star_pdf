<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">设置</h1>

    <div class="bg-white shadow-md rounded-lg overflow-hidden">
      <div class="p-6">
        <!-- 标签页导航 -->
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8">
            <button
              @click="activeTab = 'account'"
              class="py-4 px-1 border-b-2 font-medium text-sm"
              :class="
                activeTab === 'account'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              "
            >
              账号设置
            </button>
            <button
              @click="activeTab = 'api'"
              class="py-4 px-1 border-b-2 font-medium text-sm"
              :class="
                activeTab === 'api'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              "
            >
              API设置
            </button>
          </nav>
        </div>

        <!-- 账号设置 -->
        <div v-if="activeTab === 'account'" class="mt-6">
          <form @submit.prevent="updateAccount">
            <div class="space-y-6">
              <div>
                <h3 class="text-lg font-medium text-gray-900">个人信息</h3>
                <p class="mt-1 text-sm text-gray-500">
                  更新您的个人信息和账号设置。
                </p>
              </div>

              <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div class="sm:col-span-3">
                  <label
                    for="username"
                    class="block text-sm font-medium text-gray-700"
                  >
                    用户名
                  </label>
                  <div class="mt-1">
                    <input
                      id="username"
                      v-model="accountForm.username"
                      type="text"
                      disabled
                      class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md bg-gray-100"
                    />
                  </div>
                </div>

                <div class="sm:col-span-3">
                  <label
                    for="email"
                    class="block text-sm font-medium text-gray-700"
                  >
                    邮箱
                  </label>
                  <div class="mt-1">
                    <input
                      id="email"
                      v-model="accountForm.email"
                      type="email"
                      disabled
                      class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md bg-gray-100"
                    />
                  </div>
                </div>

                <div class="sm:col-span-6">
                  <label
                    for="fullName"
                    class="block text-sm font-medium text-gray-700"
                  >
                    姓名
                  </label>
                  <div class="mt-1">
                    <input
                      id="fullName"
                      v-model="accountForm.fullName"
                      type="text"
                      class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              <div class="pt-5">
                <div class="flex justify-end">
                  <button
                    type="submit"
                    :disabled="loading"
                    class="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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
                    保存
                  </button>
                </div>
              </div>
            </div>
          </form>

          <div class="mt-10 pt-10 border-t border-gray-200">
            <form @submit.prevent="updatePassword">
              <div class="space-y-6">
                <div>
                  <h3 class="text-lg font-medium text-gray-900">修改密码</h3>
                  <p class="mt-1 text-sm text-gray-500">
                    确保您的账号使用强密码以保持安全。
                  </p>
                </div>

                <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div class="sm:col-span-6">
                    <label
                      for="currentPassword"
                      class="block text-sm font-medium text-gray-700"
                    >
                      当前密码
                    </label>
                    <div class="mt-1">
                      <input
                        id="currentPassword"
                        v-model="passwordForm.currentPassword"
                        type="password"
                        required
                        class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-3">
                    <label
                      for="newPassword"
                      class="block text-sm font-medium text-gray-700"
                    >
                      新密码
                    </label>
                    <div class="mt-1">
                      <input
                        id="newPassword"
                        v-model="passwordForm.newPassword"
                        type="password"
                        required
                        class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-3">
                    <label
                      for="confirmPassword"
                      class="block text-sm font-medium text-gray-700"
                    >
                      确认新密码
                    </label>
                    <div class="mt-1">
                      <input
                        id="confirmPassword"
                        v-model="passwordForm.confirmPassword"
                        type="password"
                        required
                        class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>

                <div class="pt-5">
                  <div class="flex justify-end">
                    <button
                      type="submit"
                      :disabled="loading || !isPasswordFormValid"
                      class="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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
                      更新密码
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        <!-- API设置 -->
        <div v-if="activeTab === 'api'" class="mt-6">
          <form @submit.prevent="updateApiSettings">
            <div class="space-y-6">
              <div>
                <h3 class="text-lg font-medium text-gray-900">API设置</h3>
                <p class="mt-1 text-sm text-gray-500">
                  配置与远程API服务器的连接设置。
                </p>
              </div>

              <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div class="sm:col-span-4">
                  <label
                    for="serverUrl"
                    class="block text-sm font-medium text-gray-700"
                  >
                    服务器URL
                  </label>
                  <div class="mt-1">
                    <input
                      id="serverUrl"
                      v-model="apiForm.serverUrl"
                      type="text"
                      required
                      class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="http://localhost:8080"
                    />
                  </div>
                </div>

                <div class="sm:col-span-2">
                  <label
                    for="remoteMode"
                    class="block text-sm font-medium text-gray-700"
                  >
                    远程模式
                  </label>
                  <div class="mt-1">
                    <select
                      id="remoteMode"
                      v-model="apiForm.remoteMode"
                      class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    >
                      <option :value="true">是</option>
                      <option :value="false">否</option>
                    </select>
                  </div>
                </div>

                <div class="sm:col-span-3">
                  <label
                    for="username"
                    class="block text-sm font-medium text-gray-700"
                  >
                    API用户名
                  </label>
                  <div class="mt-1">
                    <input
                      id="username"
                      v-model="apiForm.username"
                      type="text"
                      class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div class="sm:col-span-3">
                  <label
                    for="password"
                    class="block text-sm font-medium text-gray-700"
                  >
                    API密码
                  </label>
                  <div class="mt-1">
                    <input
                      id="password"
                      v-model="apiForm.password"
                      type="password"
                      class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div class="sm:col-span-6">
                  <label
                    for="defaultOutputDir"
                    class="block text-sm font-medium text-gray-700"
                  >
                    默认输出目录
                  </label>
                  <div class="mt-1">
                    <input
                      id="defaultOutputDir"
                      v-model="apiForm.defaultOutputDir"
                      type="text"
                      class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="C:/Users/Username/Documents/Patents"
                    />
                  </div>
                  <p class="mt-2 text-sm text-gray-500">
                    指定保存提取结果的本地目录路径。如果不指定，将使用默认目录。
                  </p>
                </div>

                <div class="sm:col-span-6 mt-6">
                  <h3 class="text-lg font-medium text-gray-900">
                    远程服务器设置
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">
                    配置远程服务器URL，用于PDF转换和化学式提取。
                  </p>
                </div>

                <div class="sm:col-span-6">
                  <label
                    for="mineruServerUrl"
                    class="block text-sm font-medium text-gray-700"
                  >
                    Mineru服务器URL
                  </label>
                  <div class="mt-1">
                    <input
                      id="mineruServerUrl"
                      v-model="apiForm.mineruServerUrl"
                      type="text"
                      class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="http://172.19.1.81:8010"
                    />
                  </div>
                  <p class="mt-2 text-sm text-gray-500">
                    指定Mineru服务器URL，用于PDF转换和Word/Excel文档处理。
                  </p>
                </div>

                <div class="sm:col-span-6">
                  <label
                    for="chemicalExtractionServerUrl"
                    class="block text-sm font-medium text-gray-700"
                  >
                    化学式提取服务器URL
                  </label>
                  <div class="mt-1">
                    <input
                      id="chemicalExtractionServerUrl"
                      v-model="apiForm.chemicalExtractionServerUrl"
                      type="text"
                      class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="http://172.19.1.81:8011"
                    />
                  </div>
                  <p class="mt-2 text-sm text-gray-500">
                    指定化学式提取服务器URL，用于从文档中提取化学式和反应信息。
                  </p>
                </div>
              </div>

              <div class="pt-5">
                <div class="flex justify-end">
                  <button
                    type="button"
                    @click="testMineruConnection"
                    :disabled="loading || !apiForm.mineruServerUrl"
                    class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    测试Mineru服务器连接
                  </button>
                  <button
                    type="button"
                    @click="testChemicalConnection"
                    :disabled="loading || !apiForm.chemicalExtractionServerUrl"
                    class="ml-3 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    测试化学式提取服务器连接
                  </button>
                  <button
                    type="submit"
                    :disabled="loading"
                    class="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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
                    保存设置
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from "vue";
import { useStore } from "vuex";
import axios from "axios";

export default {
  name: "SettingsView",
  setup() {
    const store = useStore();
    const loading = computed(() => store.getters.isLoading);
    const user = computed(() => store.getters["auth/getUser"]);
    const apiSettings = computed(() => store.getters["extraction/getSettings"]);

    const activeTab = ref("account");

    // 账号表单
    const accountForm = reactive({
      username: "",
      email: "",
      fullName: "",
    });

    // 密码表单
    const passwordForm = reactive({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    // API设置表单
    const apiForm = reactive({
      serverUrl: "",
      remoteMode: false,
      username: "",
      password: "",
      defaultOutputDir: "",
      mineruServerUrl: "",
      chemicalExtractionServerUrl: "",
    });

    // 密码表单验证
    const isPasswordFormValid = computed(() => {
      return (
        passwordForm.currentPassword &&
        passwordForm.newPassword &&
        passwordForm.confirmPassword &&
        passwordForm.newPassword === passwordForm.confirmPassword &&
        passwordForm.newPassword.length >= 6
      );
    });

    // 初始化表单数据
    onMounted(async () => {
      // 初始化账号表单
      if (user.value) {
        accountForm.username = user.value.username || "";
        accountForm.email = user.value.email || "";
        accountForm.fullName = user.value.fullName || "";
      }

      // 获取API设置
      try {
        await store.dispatch("extraction/fetchSettings");

        // 初始化API表单
        apiForm.serverUrl =
          apiSettings.value.serverUrl || "http://localhost:8080";
        apiForm.remoteMode = apiSettings.value.remoteMode || false;
        apiForm.username = apiSettings.value.username || "";
        apiForm.password = ""; // 不显示密码
        apiForm.defaultOutputDir = apiSettings.value.defaultOutputDir || "";
        apiForm.mineruServerUrl =
          apiSettings.value.mineruServerUrl || "http://172.19.1.81:8010";
        apiForm.chemicalExtractionServerUrl =
          apiSettings.value.chemicalExtractionServerUrl ||
          "http://172.19.1.81:8011";
      } catch (error) {
        console.error("获取API设置失败:", error);
      }
    });

    // 更新账号信息
    const updateAccount = async () => {
      try {
        await store.dispatch("auth/updateProfile", {
          fullName: accountForm.fullName,
        });

        store.dispatch("setNotification", {
          type: "success",
          message: "账号信息已更新",
        });
      } catch (error) {
        console.error("更新账号信息失败:", error);
      }
    };

    // 更新密码
    const updatePassword = async () => {
      if (!isPasswordFormValid.value) return;

      try {
        await store.dispatch("auth/updatePassword", {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        });

        // 重置表单
        passwordForm.currentPassword = "";
        passwordForm.newPassword = "";
        passwordForm.confirmPassword = "";

        store.dispatch("setNotification", {
          type: "success",
          message: "密码已更新",
        });
      } catch (error) {
        console.error("更新密码失败:", error);
      }
    };

    // 更新API设置
    const updateApiSettings = async () => {
      try {
        await store.dispatch("extraction/updateSettings", {
          serverUrl: apiForm.serverUrl,
          remoteMode: apiForm.remoteMode,
          username: apiForm.username,
          password: apiForm.password || undefined, // 只有当有值时才更新密码
          defaultOutputDir: apiForm.defaultOutputDir,
          mineruServerUrl: apiForm.mineruServerUrl,
          chemicalExtractionServerUrl: apiForm.chemicalExtractionServerUrl,
        });

        store.dispatch("setNotification", {
          type: "success",
          message: "API设置已更新",
        });
      } catch (error) {
        console.error("更新API设置失败:", error);
      }
    };

    // 测试Mineru服务器连接
    const testMineruConnection = async () => {
      // 使用Mineru服务器URL进行测试
      if (!apiForm.mineruServerUrl) return;

      try {
        store.dispatch("setLoading", true);

        // 使用本地服务器的测试连接API，传递要测试的URL
        const response = await axios.get("/api/pdf/test-connection", {
          params: { url: apiForm.mineruServerUrl },
        });

        if (response.data.success) {
          store.dispatch("setNotification", {
            type: "success",
            message: "Mineru服务器连接成功！服务器状态正常。",
          });
        } else {
          store.dispatch("setError", "Mineru服务器连接失败：服务器返回错误。");
        }
      } catch (error) {
        console.error("测试Mineru服务器连接失败:", error);
        store.dispatch("setError", `Mineru服务器连接失败：${error.message}`);
      } finally {
        store.dispatch("setLoading", false);
      }
    };

    // 测试化学式提取服务器连接
    const testChemicalConnection = async () => {
      // 使用化学式提取服务器URL进行测试
      if (!apiForm.chemicalExtractionServerUrl) return;

      try {
        store.dispatch("setLoading", true);

        // 使用本地服务器的测试连接API，传递要测试的URL
        const response = await axios.get("/api/extraction/test-connection", {
          params: { url: apiForm.chemicalExtractionServerUrl },
        });

        if (response.data.success) {
          store.dispatch("setNotification", {
            type: "success",
            message: "化学式提取服务器连接成功！服务器状态正常。",
          });
        } else {
          store.dispatch(
            "setError",
            "化学式提取服务器连接失败：服务器返回错误。"
          );
        }
      } catch (error) {
        console.error("测试化学式提取服务器连接失败:", error);
        store.dispatch(
          "setError",
          `化学式提取服务器连接失败：${error.message}`
        );
      } finally {
        store.dispatch("setLoading", false);
      }
    };

    return {
      loading,
      activeTab,
      accountForm,
      passwordForm,
      apiForm,
      isPasswordFormValid,
      updateAccount,
      updatePassword,
      updateApiSettings,
      testMineruConnection,
      testChemicalConnection,
    };
  },
};
</script>
