<template>
  <div :class="['app-container', isDarkMode ? 'dark-theme' : 'light-theme']">
    <header class="window-header">
      <span class="title">GIF 制作器</span>
      <button class="theme-toggle" @click="isDarkMode = !isDarkMode">
        {{ isDarkMode ? "🌙 深色" : "☀️ 浅色" }}
      </button>
    </header>
    <div class="content-body scrollbar">
      <GifEditor />
    </div>
  </div>
</template>

<script setup>
import { ref, watchEffect } from "vue";
import GifEditor from "./components/GifEditor.vue";

const isDarkMode = ref(true);

// 同步 body 背景色，防止外围白边
watchEffect(() => {
  document.body.style.backgroundColor = isDarkMode.value
    ? "#121212"
    : "#f5f7fa";
});
</script>

<style>
/* 主题变量定义 */
.light-theme {
  --bg-main: #f5f7fa;
  --bg-panel: #ffffff;
  --bg-input: #ffffff;
  --text-main: #303133;
  --border-color: #dcdfe6;
}

.dark-theme {
  --bg-main: #121212;
  --bg-panel: #1e1e1e;
  --bg-input: #2c2c2c;
  --text-main: #e0e0e0;
  --border-color: #333333;
}

#app {
  height: 100vh;
  margin: 0;
}
body {
  margin: 0;
  transition: background-color 0.3s;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-main);
  color: var(--text-main);
}

.window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background-color: var(--bg-panel);
  border-bottom: 1px solid var(--border-color);
  font-weight: bold;
}

.theme-toggle {
  padding: 4px 12px;
  border-radius: 15px;
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-main);
  cursor: pointer;
}

.content-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
</style>
