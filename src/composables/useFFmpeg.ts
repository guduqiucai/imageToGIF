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
    const {
      fps,
      width,
      isVip,
      brightness,
      contrast,
      saturation,
      ratio,
      rotate,
    } = config;

    // 1. 清理环境
    try {
      const dir = await ffmpeg.listDir(".");
      for (const f of dir) if (!f.isDir) await ffmpeg.deleteFile(f.name);
    } catch (e) {}

    // 2. 写入图片
    for (let i = 0; i < binaryImageList.length; i++) {
      const fileName = `input${(i + 1).toString().padStart(3, "0")}.png`;
      await ffmpeg.writeFile(fileName, new Uint8Array(binaryImageList[i]));
    }

    // 3. 构建滤镜链
    let filterChain = [];

    // 处理旋转
    if (rotate === 90) filterChain.push("transpose=1");
    else if (rotate === 180) filterChain.push("transpose=2,transpose=2");
    else if (rotate === 270) filterChain.push("transpose=2");
    else if (rotate !== 0)
      filterChain.push(`rotate=${rotate}*PI/180:fillcolor=black`);

    // 处理调色
    const b = brightness / 100;
    const c = 1 + contrast / 100;
    const s = 1 + saturation / 100;
    filterChain.push(`eq=brightness=${b}:contrast=${c}:saturation=${s}`);

    // 处理中心裁剪
    if (ratio !== "original") {
      const [rw, rh] = ratio.split("/").map(Number);
      const targetRatio = rw / rh;
      // 先裁剪形状，定位在中心 (iw-ow)/2
      filterChain.push(
        `crop='if(gt(iw/ih,${targetRatio}),ih*${targetRatio},iw)':'if(gt(iw/ih,${targetRatio}),ih,iw/${targetRatio})'`
      );
    }

    // 最终缩放
    filterChain.push(`scale=${width}:-1:flags=lanczos`);

    const vf = filterChain.join(",");
    const inputArgs = ["-framerate", fps.toString(), "-i", "input%03d.png"];

    console.log("FFmpeg Filter Chain:", vf);

    // 4. 合成输出
    if (isVip) {
      // 调色盘生成
      await ffmpeg.exec([
        ...inputArgs,
        "-vf",
        `${vf},palettegen`,
        "palette.png",
      ]);
      // 最终合成
      await ffmpeg.exec([
        "-y",
        ...inputArgs,
        "-i",
        "palette.png",
        "-filter_complex",
        `[0:v]${vf}[x];[x][1:v]paletteuse`,
        "output.gif",
      ]);
    } else {
      await ffmpeg.exec(["-y", ...inputArgs, "-vf", vf, "output.gif"]);
    }

    const data = await ffmpeg.readFile("output.gif");
    return URL.createObjectURL(
      new Blob([(data as Uint8Array).buffer], { type: "image/gif" })
    );
  };

  return { progress, generateGif };
}
