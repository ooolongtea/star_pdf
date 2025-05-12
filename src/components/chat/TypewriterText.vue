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
      default: 15, // 每个字符的打字速度（毫秒），增加以减慢速度
    },
    startDelay: {
      type: Number,
      default: 200, // 开始打字前的延迟（毫秒），增加以更平滑
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

    // 打字效果函数 - 优化版本，减少批量处理字符数量以更平滑
    const typeText = () => {
      if (currentIndex < props.text.length) {
        // 计算本次要添加的字符数量（减少批量处理数量以更平滑）
        const charsToAdd = Math.min(3, props.text.length - currentIndex);

        // 更新显示的文本
        displayedText.value = props.text.substring(
          0,
          currentIndex + charsToAdd
        );
        currentIndex += charsToAdd;

        // 计算下一次更新的延迟时间
        // 对于中文和标点符号，使用较长的延迟
        const nextChar = props.text[currentIndex] || "";
        const isChineseOrPunctuation =
          /[\u4e00-\u9fa5]|[，。！？；：""''（）【】《》]/.test(nextChar);
        const nextDelay = isChineseOrPunctuation
          ? props.speed * 2.5 // 增加中文和标点的延迟
          : props.speed * 1.2; // 增加英文的延迟

        timer = setTimeout(typeText, nextDelay);
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
  height: 1em;
  background-color: #3b82f6; /* 蓝色光标 */
  vertical-align: middle;
  margin-left: 1px;
  animation: blink 1s step-end infinite;
  border-radius: 1px;
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
