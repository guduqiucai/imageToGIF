<template>
  <div class="app-container">
    <header class="window-header">
      <span class="title">GIF 制作器</span>
    </header>
    <div class="content-body">
      <GifEditor />
    </div>
  </div>
</template>

<script setup>
import GifEditor from './components/GifEditor.vue';
</script>

<style>
/* 确保根节点撑满窗口 */
#app {
  height: 100vh;
  margin: 0;
  background-color: #ffffff;
}
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.window-header {
  padding: 10px 20px;
  border-bottom: 1px solid #eee;
  font-weight: bold;
}
.content-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
</style>