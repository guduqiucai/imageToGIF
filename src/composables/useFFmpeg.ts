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
    console.log("[FFmpeg]", message);
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

  ffmpeg.on("progress", ({ progress: p }) => {
    progress.value = Math.round(p * 100);
  });

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const generateGif = async (binaryImageList: Uint8Array[], config: GifConfig) => {
    if (!isLoaded.value) await loadFFmpeg();

    const { fps, width, isVip, brightness, contrast, saturation, ratio, rotate } = config;

    // 1. 清理工作目录
    try {
      const files = await ffmpeg.listDir(".");
      for (const f of files) {
        if (!f.isDir) await ffmpeg.deleteFile(f.name);
      }
    } catch (e) {}

    // 2. 写入图片（编号从 000 开始）
    for (let i = 0; i < binaryImageList.length; i++) {
      const fileName = `input${i.toString().padStart(3, "0")}.png`;
      await ffmpeg.writeFile(fileName, new Uint8Array(binaryImageList[i]));
    }
    await sleep(500);

    // 3. 构建滤镜链
    const filterParts: string[] = [];

    if (rotate === 90) filterParts.push("transpose=1");
    else if (rotate === 180) filterParts.push("transpose=2,transpose=2");
    else if (rotate === 270) filterParts.push("transpose=2");
    else if (rotate !== 0) filterParts.push(`rotate=${rotate}*PI/180:fillcolor=black`);

    const b = brightness / 100;
    const c = 1 + contrast / 100;
    const s = 1 + saturation / 100;
    filterParts.push(`eq=brightness=${b}:contrast=${c}:saturation=${s}`);

    // 先统一缩放
    filterParts.push(`scale=${width}:-1:flags=lanczos`);

    // 比例裁剪（仅当不是原始比例时）
    if (ratio !== "original") {
      const [rw, rh] = ratio.split("/").map(Number);
      if (rw > 0 && rh > 0) {
        const targetRatio = rw / rh;
        // 安全裁剪表达式，确保结果为正
        filterParts.push(`crop='min(iw,ih*${targetRatio})':'min(ih,iw/${targetRatio})'`);
      }
    }

    const baseFilter = filterParts.join(",");
    console.log("最终滤镜链:", baseFilter);

    const inputArgs = ["-framerate", fps.toString(), "-start_number", "0", "-i", "input%03d.png"];

    try {
      // 生成中间普通 GIF（与基础版命令完全一致）
      console.log("生成中间普通 GIF...");
      await ffmpeg.exec(["-y", ...inputArgs, "-vf", baseFilter, "temp.gif"]);
      await sleep(300);

      let finalData: Uint8Array;
      if (isVip) {
        console.log("VIP模式：生成调色板...");
        await ffmpeg.exec(["-y", "-i", "temp.gif", "-vf", "palettegen=stats_mode=diff", "palette.png"]);
        await sleep(300);

        console.log("VIP模式：应用调色板合成最终 GIF...");
        await ffmpeg.exec(["-y", "-i", "temp.gif", "-i", "palette.png", "-filter_complex", "[0:v][1:v]paletteuse", "output.gif"]);
        await sleep(300);
        finalData = await ffmpeg.readFile("output.gif") as Uint8Array;
      } else {
        finalData = await ffmpeg.readFile("temp.gif") as Uint8Array;
      }

      if (!finalData || finalData.length === 0) {
        throw new Error("生成的 GIF 文件为空");
      }

      const uint8Copy = new Uint8Array(finalData);
      const blob = new Blob([uint8Copy], { type: "image/gif" });
      console.log("GIF生成成功，大小:", blob.size);
      return URL.createObjectURL(blob);
    } catch (err: any) {
      console.error("FFmpeg执行失败:", err);
      const fileList = await ffmpeg.listDir(".");
      console.error("目录文件:", fileList);
      throw err;
    }
  };

  return { isLoaded, progress, loadFFmpeg, generateGif };
}