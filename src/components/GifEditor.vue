<template>
  <div class="gif-container">

    <main class="main-layout">
      <aside class="settings-panel scrollbar">
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
          <label>输出宽度 (px):</label>
          <input type="number" v-model.number="width" class="input-number" />
        </div>

        <div class="divider">比例裁剪</div>
        <div class="ratio-grid">
          <button
            v-for="r in ratios"
            :key="r.name"
            :class="['ratio-btn', { active: ratio === r.value }]"
            @click="ratio = r.value"
          >
            {{ r.name }}
          </button>
        </div>

        <div class="control-group" style="margin-top: 20px">
          <label>旋转角度: {{ rotate }}°</label>
          <input
            type="range"
            v-model.number="rotate"
            min="0"
            max="360"
            step="90"
            class="slider"
          />
          <button class="reset-btn" @click="rotate = 0">恢复原状</button>
        </div>

        <div class="divider">图像滤镜</div>
        <div class="control-group">
          <label>亮度: {{ brightness }}</label>
          <input
            type="range"
            v-model.number="brightness"
            min="-50"
            max="50"
            class="slider"
          />
        </div>
        <div class="control-group">
          <label>对比度: {{ contrast }}</label>
          <input
            type="range"
            v-model.number="contrast"
            min="-50"
            max="50"
            class="slider"
          />
        </div>
        <div class="control-group">
          <label>饱和度: {{ saturation }}</label>
          <input
            type="range"
            v-model.number="saturation"
            min="-50"
            max="50"
            class="slider"
          />
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
          <span v-if="images.length > 0" class="tip"
            >共 {{ images.length }} 帧（拖拽数字排序）</span
          >
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
          :force-fallback="true"
        >
          <template #item="{ element, index }">
            <div class="preview-item">
              <div class="drag-handle">{{ index + 1 }}</div>
              <div class="img-wrapper" :style="getPreviewStyle">
                <img
                  :src="element.url"
                  :style="{
                    transform: `rotate(${rotate}deg)`,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }"
                />
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
import { ref, nextTick, computed } from "vue";
import draggable from "vuedraggable";
import { useFFmpeg } from "../composables/useFFmpeg";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

const fps = ref(10);
const width = ref(500);
const isVip = ref(true);
const brightness = ref(0);
const contrast = ref(0);
const saturation = ref(0);
const ratio = ref("original");
const rotate = ref(0);

const ratios = [
  { name: "原始", value: "original" },
  { name: "1:1", value: "1/1" },
  { name: "4:3", value: "4/3" },
  { name: "16:9", value: "16/9" },
  { name: "9:16", value: "9/16" },
];
const images = ref([]);
const processing = ref(false);
const preProcessing = ref(false);
const resultUrl = ref("");
const { progress, generateGif } = useFFmpeg();

const getPreviewStyle = computed(() => ({
  filter: `brightness(${100 + brightness.value}%) contrast(${
    100 + contrast.value
  }%) saturate(${100 + saturation.value}%)`,
  aspectRatio: ratio.value === "original" ? "auto" : ratio.value,
}));

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
      binaryData.push(new Uint8Array(await item.file.arrayBuffer()));
    }
    preProcessing.value = false;
    processing.value = true;
    const url = await generateGif(binaryData, {
      fps: fps.value,
      width: width.value,
      isVip: isVip.value,
      brightness: brightness.value,
      contrast: contrast.value,
      saturation: saturation.value,
      ratio: ratio.value,
      rotate: rotate.value,
    });
    await nextTick();
    setTimeout(() => {
      resultUrl.value = url;
    }, 50);
  } catch (err) {
    console.error("失败:", err);
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
    await writeFile(filePath, new Uint8Array(await res.arrayBuffer()));
  }
};
</script>

<style scoped>
/* 核心改动：仅将颜色替换为变量，布局参数 100% 还原 */
.gif-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
  color: var(--text-main);
  user-select: none;
}
header {
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 20px;
  display: flex;
  align-items: baseline;
}
h1 {
  color: var(--text-main);
  margin: 0;
}
.version-tag {
  color: #666;
  font-size: 12px;
  margin-left: 10px;
}

.main-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 40px;
}

.settings-panel {
  background: var(--bg-panel);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  height: 88vh;
  overflow-y: auto;
}

.divider {
  margin: 25px 0 15px;
  padding-top: 15px;
  border-top: 1px solid var(--border-color);
  font-size: 13px;
  color: #409eff;
  font-weight: bold;
}
.control-group label {
  display: block;
  margin-bottom: 10px;
  font-weight: bold;
  font-size: 14px;
}
.input-number {
  width: 100%;
  padding: 10px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  border-radius: 6px;
}
.slider {
  width: 100%;
  cursor: pointer;
  accent-color: #409eff;
}

.ratio-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.ratio-btn {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: #888;
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.ratio-btn.active {
  border-color: #409eff;
  color: #409eff;
  background: rgba(64, 158, 255, 0.1);
}
.reset-btn {
  width: 100%;
  margin-top: 10px;
  background: var(--border-color);
  color: var(--text-main);
  border: none;
  padding: 5px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.vip-box {
  background: var(--bg-input);
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-top: 10px;
}

.btn-run {
  width: 100%;
  padding: 14px;
  background: #2e7d32;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  margin-top: 20px;
}
.btn-run:disabled {
  background: #424242;
  color: #888;
}

.btn-select {
  background: #1976d2;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
}
.tip {
  margin-left: 10px;
  color: #999;
  font-size: 13px;
}

/* 预览列表布局保持不动 */
.preview-list {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  border: 2px dashed var(--border-color);
  padding: 20px;
  border-radius: 12px;
  background: var(--bg-panel);
  min-height: 150px;
}
/* 图片尺寸严格锁定 100x100 */
.preview-item {
  width: 100px;
  height: 100px;
  position: relative;
}
.img-wrapper {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  transition: all 0.3s;
}

.drag-handle {
  position: absolute;
  top: -10px;
  left: -10px;
  background: #1976d2;
  color: #fff;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: move;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}
.remove-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #c62828;
  color: #fff;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 11;
}

.result-section {
  margin-top: 40px;
  border-top: 1px solid var(--border-color);
  padding-top: 20px;
}
.btn-download {
  background: #00897b;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  cursor: pointer;
}
.final-gif {
  max-width: 100%;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
}

.scrollbar::-webkit-scrollbar {
  width: 4px;
}
.scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 10px;
}
</style>
