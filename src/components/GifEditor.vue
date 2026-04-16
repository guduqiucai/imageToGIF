<template>
  <div class="gif-container">
    <header>
      <h1>GIF 制作器</h1>
      <span class="version-tag">v1.1.0 - 格式修正版</span>
    </header>

    <main class="main-layout">
      <aside class="settings-panel">
        <h3>生成参数</h3>
        <div class="control-group">
          <label>播放速度 (FPS): {{ fps }}</label>
          <input
            type="range"
            v-model.number="fps"
            min="1"
            max="20"
            class="slider"
          />
        </div>
        <div class="control-group">
          <label>宽度 (px):</label>
          <input type="number" v-model.number="width" class="input-number" />
        </div>
        <div class="control-group vip-box">
          <label class="checkbox-label">
            <input type="checkbox" v-model="isVip" />
            <span>开启 VIP 高清调色盘</span>
          </label>
        </div>

        <button
          :disabled="processing || preProcessing || images.length < 2"
          @click="handleExport"
          class="btn-run"
        >
          {{
            processing
              ? `合成中 ${progress}%`
              : preProcessing
              ? "准备数据..."
              : "生成 GIF"
          }}
        </button>
      </aside>

      <section class="content-area">
        <div class="action-bar">
          <button @click="triggerUpload" class="btn-select">选择图片</button>
          <span v-if="images.length > 0" class="tip">
            已选 {{ images.length }} 张（请按住蓝色圆圈拖拽排序）
          </span>
        </div>
        <input
          type="file"
          multiple
          accept="image/*"
          @change="handleUpload"
          id="fileInput"
          hidden
        />

        <draggable
          v-model="images"
          item-key="id"
          handle=".drag-handle"
          tag="div"
          class="preview-list"
          :animation="250"
          ghost-class="ghost"
          chosen-class="chosen"
          drag-class="dragging"
          :force-fallback="true"
        >
          <template #item="{ element, index }">
            <div class="preview-item">
              <div class="drag-handle">{{ index + 1 }}</div>
              <div class="img-wrapper">
                <img :src="element.url" />
              </div>
              <div class="remove-btn" @click.stop="removeImage(element.id)">
                ×
              </div>
            </div>
          </template>
        </draggable>

        <div v-if="resultUrl" class="result-section">
          <div class="result-header">
            <h4>生成结果：</h4>
            <button @click="downloadGif" class="btn-download">
              下载 GIF文件
            </button>
          </div>
          <img :src="resultUrl" :key="resultUrl" class="final-gif" />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, nextTick } from "vue";
import draggable from "vuedraggable";
import { useFFmpeg } from "../composables/useFFmpeg";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

const fps = ref(5);
const width = ref(500);
const isVip = ref(true);
const images = ref([]);
const processing = ref(false);
const preProcessing = ref(false);
const resultUrl = ref("");
const { progress, generateGif } = useFFmpeg();

const triggerUpload = () => document.getElementById("fileInput").click();

const handleUpload = (e) => {
  const files = Array.from(e.target.files);
  files.forEach((file) => {
    images.value.push({
      id: `img_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
      file: file,
      url: URL.createObjectURL(file),
    });
  });
  e.target.value = "";
};

const removeImage = (id) => {
  images.value = images.value.filter((item) => item.id !== id);
};

const handleExport = async () => {
  if (images.value.length < 2) return alert("请至少添加2张图片");
  preProcessing.value = true;
  resultUrl.value = "";

  try {
    const binaryData = [];
    for (const item of images.value) {
      const buffer = await item.file.arrayBuffer();
      binaryData.push(new Uint8Array(buffer));
    }
    preProcessing.value = false;
    processing.value = true;

    const url = await generateGif(binaryData, {
      fps: fps.value,
      width: width.value,
      isVip: isVip.value,
    });

    await nextTick();
    setTimeout(() => {
      resultUrl.value = url;
    }, 50);
  } catch (err) {
    console.error("合成失败:", err);
  } finally {
    preProcessing.value = false;
    processing.value = false;
  }
};

const downloadGif = async () => {
  const filePath = await save({
    filters: [{ name: "GIF", extensions: ["gif"] }],
  });
  if (filePath) {
    const res = await fetch(resultUrl.value);
    const buffer = await res.arrayBuffer();
    await writeFile(filePath, new Uint8Array(buffer));
  }
};
</script>

<style scoped>
.gif-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  user-select: none;
}
header {
  border-bottom: 1px solid #eee;
  margin-bottom: 20px;
  display: flex;
  align-items: baseline;
}
.version-tag {
  color: #999;
  font-size: 12px;
  margin-left: 10px;
}
.main-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 40px;
}

.settings-panel {
  background: #fcfcfc;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #eaeaea;
  height: fit-content;
}
.control-group {
  margin-bottom: 25px;
}
.control-group label {
  display: block;
  margin-bottom: 10px;
  font-weight: bold;
}
.slider {
  width: 100%;
  cursor: pointer;
}
.input-number {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
}
.vip-box {
  background: #fff;
  padding: 12px;
  border: 1px solid #ffeeba;
  border-radius: 8px;
}

.btn-run {
  width: 100%;
  padding: 14px;
  background: #67c23a;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
}
.btn-run:disabled {
  background: #ccc;
}

.btn-select {
  background: #409eff;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
}
.tip {
  margin-left: 10px;
  color: #666;
  font-size: 13px;
}

.preview-list {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  min-height: 150px;
  border: 2px dashed #dcdfe6;
  padding: 20px;
  border-radius: 12px;
  background: #fafafa;
}

.preview-item {
  width: 100px;
  height: 100px;
  position: relative;
  background: #fff;
  border-radius: 8px;
}
.img-wrapper {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #eee;
}
.img-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.drag-handle {
  position: absolute;
  top: -10px;
  left: -10px;
  background: #409eff;
  color: #fff;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: move;
  z-index: 100;
}

.remove-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #f56c6c;
  color: #fff;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 101;
}

.ghost {
  opacity: 0.2;
  background: #c8ebfb !important;
}
.result-section {
  margin-top: 40px;
  border-top: 1px solid #eee;
  padding-top: 20px;
}
.btn-download {
  background: #10b981;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  cursor: pointer;
}
.final-gif {
  max-width: 100%;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}
</style>
