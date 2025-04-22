<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"
  >
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
          注册新账号
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          或
          <router-link
            to="/login"
            class="font-medium text-blue-600 hover:text-blue-500"
          >
            登录已有账号
          </router-link>
        </p>
      </div>
      <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div class="rounded-md shadow-sm -space-y-px">
          <div>
            <label for="username" class="sr-only">用户名</label>
            <input
              id="username"
              v-model="form.username"
              name="username"
              type="text"
              required
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="用户名"
            />
          </div>
          <div>
            <label for="email" class="sr-only">邮箱</label>
            <input
              id="email"
              v-model="form.email"
              name="email"
              type="email"
              required
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="邮箱"
            />
          </div>
          <div>
            <label for="fullName" class="sr-only">姓名</label>
            <input
              id="fullName"
              v-model="form.fullName"
              name="fullName"
              type="text"
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="姓名（可选）"
            />
          </div>
          <div>
            <label for="password" class="sr-only">密码</label>
            <input
              id="password"
              v-model="form.password"
              name="password"
              type="password"
              required
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="密码"
            />
          </div>
          <div>
            <label for="confirmPassword" class="sr-only">确认密码</label>
            <input
              id="confirmPassword"
              v-model="form.confirmPassword"
              name="confirmPassword"
              type="password"
              required
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="确认密码"
            />
          </div>
          <div>
            <div class="flex items-center justify-between mt-2">
              <label for="verification-code" class="sr-only">验证码</label>
              <input
                id="verification-code"
                v-model="form.verificationCode"
                name="verification-code"
                type="text"
                required
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="验证码"
              />
              <button
                type="button"
                @click="sendVerificationCode"
                :disabled="cooldown > 0 || !form.email"
                class="ml-2 whitespace-nowrap inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {{ cooldown > 0 ? `${cooldown}秒后重试` : "获取验证码" }}
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center">
          <input
            id="agree-terms"
            v-model="form.agreeTerms"
            name="agree-terms"
            type="checkbox"
            required
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="agree-terms" class="ml-2 block text-sm text-gray-900">
            我已阅读并同意
            <a href="#" class="font-medium text-blue-600 hover:text-blue-500">
              服务条款
            </a>
            和
            <a href="#" class="font-medium text-blue-600 hover:text-blue-500">
              隐私政策
            </a>
          </label>
        </div>

        <div>
          <button
            type="submit"
            :disabled="loading || !isFormValid"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <span class="absolute left-0 inset-y-0 flex items-center pl-3">
              <svg
                v-if="!loading"
                class="h-5 w-5 text-blue-500 group-hover:text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clip-rule="evenodd"
                />
              </svg>
              <svg
                v-else
                class="animate-spin h-5 w-5 text-white"
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
            </span>
            {{ loading ? "注册中..." : "注册" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, computed, reactive } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";

export default {
  name: "RegisterView",
  setup() {
    const store = useStore();
    const router = useRouter();

    const loading = computed(() => store.getters.isLoading);
    const cooldown = ref(0);

    const form = reactive({
      username: "",
      email: "",
      fullName: "",
      password: "",
      confirmPassword: "",
      verificationCode: "",
      agreeTerms: false,
    });

    // 表单验证
    const isFormValid = computed(() => {
      return (
        form.username &&
        form.email &&
        form.password &&
        form.confirmPassword &&
        form.password === form.confirmPassword &&
        form.verificationCode &&
        form.agreeTerms
      );
    });

    // 发送验证码
    const sendVerificationCode = async () => {
      if (cooldown.value > 0 || !form.email) return;

      try {
        // 发送验证码
        await store.dispatch("auth/sendVerificationCode", form.email);

        // 设置冷却时间
        cooldown.value = 60;
        const timer = setInterval(() => {
          cooldown.value--;
          if (cooldown.value <= 0) {
            clearInterval(timer);
          }
        }, 1000);
      } catch (error) {
        console.error("发送验证码失败:", error);
      }
    };

    // 提交表单
    const handleSubmit = async () => {
      if (!isFormValid.value) return;

      try {
        await store.dispatch("auth/register", {
          username: form.username,
          email: form.email,
          fullName: form.fullName,
          password: form.password,
          verificationCode: form.verificationCode,
        });

        // 注册成功后跳转到仪表盘
        router.push("/dashboard");
      } catch (error) {
        console.error("注册失败:", error);
      }
    };

    return {
      form,
      loading,
      cooldown,
      isFormValid,
      sendVerificationCode,
      handleSubmit,
    };
  },
};
</script>
