import { ref } from "vue";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

interface GifConfig {
  fps: number;
  width: number;
  isVip: boolean;
}

export function useFFmpeg() {
  const ffmpeg = new FFmpeg();
  const isLoaded = ref(false);
  const progress = ref(0);

  const loadFFmpeg = async () => {
    if (isLoaded.value) return;
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });
    isLoaded.value = true;
  };

  ffmpeg.on("progress", ({ progress: p }) => {
    progress.value = Math.round(p * 100);
  });

  const generateGif = async (
    binaryImageList: Uint8Array[],
    config: GifConfig
  ) => {
    if (!isLoaded.value) await loadFFmpeg();
    const { fps, width, isVip } = config;

    // 1. 彻底清理环境，防止旧文件干扰
    try {
      const dir = await ffmpeg.listDir(".");
      for (const f of dir) {
        if (!f.isDir) await ffmpeg.deleteFile(f.name);
      }
    } catch (e) {}

    // 2. 写入图片：使用 new Uint8Array 强制内存拷贝，防止被 Worker 意外回收
    for (let i = 0; i < binaryImageList.length; i++) {
      const fileName = `input${(i + 1).toString().padStart(3, "0")}.png`;
      await ffmpeg.writeFile(fileName, new Uint8Array(binaryImageList[i]));
    }

    const filterString = `scale=${width}:-1:flags=lanczos`;
    // 关键：-framerate 必须在 -i 之前，强制每张图的时长
    const inputArgs = ["-framerate", fps.toString(), "-i", "input%03d.png"];

    console.log("FFmpeg 开始合成，参数:", { fps, width, isVip });

    if (isVip) {
      // 步骤 A: 生成调色盘
      await ffmpeg.exec([
        ...inputArgs,
        "-vf",
        `${filterString},palettegen`,
        "palette.png",
      ]);

      // 步骤 B: 应用调色盘合成 GIF
      await ffmpeg.exec([
        "-y",
        ...inputArgs,
        "-i",
        "palette.png",
        "-filter_complex",
        `[0:v]${filterString}[x];[x][1:v]paletteuse`,
        "output.gif",
      ]);
    } else {
      await ffmpeg.exec([
        "-y",
        ...inputArgs,
        "-vf",
        filterString,
        "output.gif",
      ]);
    }

    // 3. 读取并封装为显式类型的 Blob
    const data = await ffmpeg.readFile("output.gif");
    const gifBlob = new Blob([(data as Uint8Array).buffer], {
      type: "image/gif",
    });

    console.log(`合成完成，文件大小: ${(gifBlob.size / 1024).toFixed(2)} KB`);

    return URL.createObjectURL(gifBlob);
  };

  return { progress, generateGif };
}
