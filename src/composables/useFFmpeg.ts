import { ref } from "vue";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

interface GifConfig {
  fps: number;
  width: number;
  isVip: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  ratio: string;
  rotate: number;
}

export function useFFmpeg() {
  const ffmpeg = new FFmpeg();
  const isLoaded = ref(false);
  const progress = ref(0);

  ffmpeg.on("log", ({ message }) => {
    console.log("[FFmpeg内核日志]:", message);
  });

  ffmpeg.on("progress", ({ progress: p }) => {
    const safeProgress = Math.max(0, Math.min(1, p));
    progress.value = Math.round(safeProgress * 100);
  });

  const loadFFmpeg = async () => {
    if (isLoaded.value) return;
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    isLoaded.value = true;
  };

  const generateGif = async (binaryImageList: any[], config: GifConfig) => {
    if (!isLoaded.value) await loadFFmpeg();
    
    // 每次开始前强制重置进度和清理上一次残留
    progress.value = 0;

    const { fps, width, isVip, brightness, contrast, saturation, ratio, rotate } = config;

    try {
      // --- 关键修复：深度清理虚拟文件系统 ---
      const rootFiles = await ffmpeg.listDir(".");
      for (const f of rootFiles) {
        if (!f.isDir) {
          await ffmpeg.deleteFile(f.name).catch(() => {});
        }
      }

      // --- 关键修复：解决 DataCloneError ---
      // 使用 .slice() 或重新包装来确保我们发送的是原始 ArrayBuffer 的拷贝，而不是 Vue Proxy
      for (let i = 0; i < binaryImageList.length; i++) {
        const fileName = `input${i.toString().padStart(3, "0")}.png`;
        // 这里的转换非常重要：获取底层 ArrayBuffer 并创建全新的 Uint8Array 视图
        const buffer = binaryImageList[i].buffer || binaryImageList[i];
        const uint8 = new Uint8Array(buffer.slice ? buffer.slice(0) : buffer);
        await ffmpeg.writeFile(fileName, uint8);
      }

      // 构建滤镜
      const targetW = width % 2 === 0 ? width : width - 1;
      let vf = `eq=brightness=${brightness/100}:contrast=${1+contrast/100}:saturation=${1+saturation/100},scale=${targetW}:-2:flags=lanczos`;
      
      if (rotate !== 0) {
        const trans: any = { 90: "transpose=1", 180: "transpose=2,transpose=2", 270: "transpose=2" };
        vf += `,${trans[rotate] || `rotate=${rotate}*PI/180:fillcolor=black`}`;
      }

      if (ratio !== "original") {
        const [rw, rh] = ratio.split("/").map(Number);
        vf += `,crop='min(iw,ih*${rw/rh})':'min(ih,iw/${rw/rh})'`;
      }

      // 生成中间件
      await ffmpeg.exec(["-y", "-framerate", fps.toString(), "-i", "input%03d.png", "-vf", vf, "-c:v", "ffv1", "temp.mkv"]);

      if (isVip) {
        await ffmpeg.exec(["-y", "-i", "temp.mkv", "-vf", "palettegen=stats_mode=full", "palette.png"]);
        await ffmpeg.exec(["-y", "-i", "temp.mkv", "-i", "palette.png", "-filter_complex", "[0:v][1:v]paletteuse=dither=none:diff_mode=1", "output.gif"]);
      } else {
        await ffmpeg.exec(["-y", "-i", "temp.mkv", "output.gif"]);
      }

      const rawResult = await ffmpeg.readFile("output.gif");
      const finalData = new Uint8Array(rawResult as ArrayBuffer);
      const url = URL.createObjectURL(new Blob([finalData], { type: "image/gif" }));

      // --- 任务结束：立即释放 WASM 内存 ---
      // 不清理会导致第二次执行时内存重叠触发 Aborted()
      setTimeout(() => {
        ffmpeg.deleteFile("temp.mkv").catch(() => {});
        ffmpeg.deleteFile("output.gif").catch(() => {});
        ffmpeg.deleteFile("palette.png").catch(() => {});
      }, 1000);

      progress.value = 100;
      return url;

    } catch (err: any) {
      console.error("生成失败:", err);
      // 如果出现错误，建议刷新页面或重新加载内核
      if (err.message?.includes("Aborted")) {
        isLoaded.value = false; // 标记失效，强制下次重新加载
      }
      throw err;
    }
  };

  return { isLoaded, progress, loadFFmpeg, generateGif };
}