<template>
  <div>
    <span v-html="displayedText"></span>
    <span v-if="isTyping" class="typing-cursor">|</span>
  </div>
</template>

<script>
import { ref, watch, onMounted, onBeforeUnmount } from "vue";

export default {
  name: "TypewriterText",
  props: {
    text: {
      type: String,
      required: true,
    },
    speed: {
      type: Number,
      default: 10, // 每个字符的打字速度（毫秒）
    },
    startDelay: {
      type: Number,
      default: 100, // 开始打字前的延迟（毫秒）
    },
    skipAnimation: {
      type: Boolean,
      default: false, // 是否跳过动画，直接显示全部文本
    },
  },
  emits: ["typed"],
  setup(props, { emit }) {
    const displayedText = ref("");
    const isTyping = ref(false);
    let timer = null;
    let currentIndex = 0;

    // 打字效果函数
    const typeText = () => {
      if (currentIndex < props.text.length) {
        displayedText.value = props.text.substring(0, currentIndex + 1);
        currentIndex++;
        timer = setTimeout(typeText, props.speed);
      } else {
        isTyping.value = false;
        emit("typed");
      }
    };

    // 开始打字效果
    const startTyping = () => {
      isTyping.value = true;
      currentIndex = 0;
      displayedText.value = "";

      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(typeText, props.startDelay);
    };

    // 监听文本变化
    watch(
      () => props.text,
      () => {
        startTyping();
      }
    );

    // 组件挂载时开始打字
    onMounted(() => {
      if (props.skipAnimation) {
        // 如果跳过动画，直接显示全部文本
        displayedText.value = props.text;
        isTyping.value = false;
        emit("typed");
      } else {
        startTyping();
      }
    });

    // 组件卸载前清除定时器
    onBeforeUnmount(() => {
      if (timer) {
        clearTimeout(timer);
      }
    });

    return {
      displayedText,
      isTyping,
    };
  },
};
</script>

<style scoped>
.typing-cursor {
  display: inline-block;
  width: 2px;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  from,
  to {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
</style>
