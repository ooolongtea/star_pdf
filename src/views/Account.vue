<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">账号管理</h1>

    <div class="bg-white shadow-md rounded-lg overflow-hidden">
      <div class="p-6">
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
                    readonly
                    class="shadow-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
                <p class="mt-2 text-xs text-gray-500">用户名不可更改。</p>
              </div>

              <div class="sm:col-span-3">
                <label
                  for="email"
                  class="block text-sm font-medium text-gray-700"
                >
                  电子邮箱
                </label>
                <div class="mt-1">
                  <input
                    id="email"
                    v-model="accountForm.email"
                    type="email"
                    readonly
                    class="shadow-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
                <p class="mt-2 text-xs text-gray-500">邮箱地址不可更改。</p>
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
                  保存信息
                </button>
              </div>
            </div>
          </div>
        </form>

        <div class="mt-10 pt-10 border-t border-gray-200">
          <h3 class="text-lg font-medium text-gray-900">修改密码</h3>
          <p class="mt-1 text-sm text-gray-500">
            定期更新您的密码以保护账号安全。
          </p>

          <form @submit.prevent="updatePassword" class="mt-6">
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
                <p class="mt-2 text-xs text-gray-500">
                  密码长度至少为8个字符，包含字母和数字。
                </p>
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
                  :disabled="!isPasswordFormValid || loading"
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
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { reactive, computed, onMounted } from "vue";
import { useStore } from "vuex";

export default {
  name: "AccountView",
  setup() {
    const store = useStore();
    const loading = computed(() => store.getters.isLoading);
    const user = computed(() => store.getters["auth/getUser"]);

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

    // 密码表单验证
    const isPasswordFormValid = computed(() => {
      return (
        passwordForm.newPassword.length >= 8 &&
        /[a-zA-Z]/.test(passwordForm.newPassword) &&
        /[0-9]/.test(passwordForm.newPassword) &&
        passwordForm.newPassword === passwordForm.confirmPassword
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

        // 清空密码表单
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

    return {
      loading,
      accountForm,
      passwordForm,
      isPasswordFormValid,
      updateAccount,
      updatePassword,
    };
  },
};
</script>
