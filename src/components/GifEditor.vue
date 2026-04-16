<template>
  <div class="gif-container">
    <h2>GIF 制作器</h2>

    <div class="upload-section">
      <input type="file" multiple accept="image/*" @change="handleUpload" id="fileInput" hidden />
      <button @click="triggerUpload">选择图片</button>
      <span v-if="images.length > 0">已选 {{ images.length }} 张（可拖拽排序）</span>
    </div>

    <draggable 
      v-model="images" 
      item-key="id" 
      class="preview-list"
      ghost-class="ghost"
    >
      <template #item="{ element }">
        <div class="preview-item">
          <img :src="element.url" />
          <div class="remove-btn" @click="removeImage(element.id)">×</div>
        </div>
      </template>
    </draggable>

    <div class="export-controls" v-if="images.length > 0">
      <label>
        <input type="checkbox" v-model="isVip" /> 开启 VIP 高清无水印导出
      </label>
      
      <button :disabled="processing" @click="handleExport">
        {{ processing ? `生成中 ${progress}%` : '开始生成 GIF' }}
      </button>
    </div>

    <div v-if="resultUrl" class="result-section">
      <h3>生成结果：</h3>
      <button @click="downloadGif" class="download-btn">保存到本地</button>
      <img :src="resultUrl" class="final-gif" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import draggable from 'vuedraggable';
import { useFFmpeg } from '../composables/useFFmpeg';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

const images = ref([]);
const isVip = ref(false);
const processing = ref(false);
const resultUrl = ref('');
const { progress, generateGif } = useFFmpeg();

const downloadGif = async () => {
  if (!resultUrl.value) return;

  try {
    // 1. 弹出系统原生的“另存为”对话框
    const filePath = await save({
      filters: [{ name: 'GIF Image', extensions: ['gif'] }],
      defaultPath: 'my-animation.gif'
    });

    if (filePath) {
      // 2. 将 Blob URL 转为 ArrayBuffer 数据
      const response = await fetch(resultUrl.value);
      const buffer = await response.arrayBuffer();

      // 3. 写入文件到用户选择的路径
      await writeFile(filePath, new Uint8Array(buffer));
      alert('保存成功！');
    }
  } catch (err) {
    console.error('保存失败:', err);
    alert('保存失败，请检查控制台');
  }
};

const triggerUpload = () => document.getElementById('fileInput').click();

const handleUpload = (e) => {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    images.value.push({
      id: Math.random().toString(36).substr(2, 9),
      file: file,
      url: URL.createObjectURL(file)
    });
  });
};

const removeImage = (id) => {
  images.value = images.value.filter(item => item.id !== id);
};

const handleExport = async () => {
  if (images.value.length < 2) return alert('请至少选择两张图片');
  
  processing.value = true;
  try {
    resultUrl.value = await generateGif(images.value, isVip.value);
  } catch (error) {
    console.error('生成失败:', error);
    alert('合成失败，请检查控制台');
  } finally {
    processing.value = false;
  }
};
</script>

<style scoped>
.preview-list { display: flex; gap: 10px; margin: 20px 0; flex-wrap: wrap; }
.preview-item { width: 100px; height: 100px; position: relative; border: 1px solid #ddd; }
.preview-item img { width: 100%; height: 100%; object-fit: cover; }
.remove-btn { position: absolute; top: -5px; right: -5px; background: red; color: white; border-radius: 50%; width: 20px; height: 20px; text-align: center; cursor: pointer; }
.ghost { opacity: 0.5; background: #c8ebfb; }
.final-gif { max-width: 100%; border: 2px solid #42b983; }
.export-controls { margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
</style>