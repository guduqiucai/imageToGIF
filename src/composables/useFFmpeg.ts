import { ref } from 'vue';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export function useFFmpeg() {
  const ffmpeg = new FFmpeg();
  const isLoaded = ref(false);
  const progress = ref(0);

  // 加载 FFmpeg 核心文件
  const loadFFmpeg = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    isLoaded.value = true;
  };

  // 监听进度
  ffmpeg.on('progress', ({ progress: p }) => {
    progress.value = Math.round(p * 100);
  });

  const generateGif = async (fileList: any[], isVip: boolean) => {
    if (!isLoaded.value) await loadFFmpeg();

    // --- 1. 终极强力清理：删除所有残留的 .png 和 output.gif ---
    try {
      const allFiles = await ffmpeg.listDir('.');
      for (const f of allFiles) {
        if (f.name.endsWith('.png') || f.name === 'output.gif') {
          console.log('正在暴力清理残留文件:', f.name);
          await ffmpeg.deleteFile(f.name);
        }
      }
    } catch (e) {
      console.log('清理过程跳过（可能是空的）');
    }

    // --- 2. 写入新文件 ---
    console.log('开始写入新的图片文件...');
    for (let i = 0; i < fileList.length; i++) {
      const response = await fetch(fileList[i].url);
      const arrayBuffer = await response.arrayBuffer();
      const fileName = `input${i.toString().padStart(3, '0')}.png`;
      await ffmpeg.writeFile(fileName, new Uint8Array(arrayBuffer));
    }
    console.log('文件写入完毕。');

    // --- 3. 关键：暴力延迟 500ms，等待 WASM FS 刷新 ---
    await new Promise(resolve => setTimeout(resolve, 500)); 
    console.log('延迟等待结束，开始合成...');

    // --- 4. 终极简化指令（暂时绕过复杂滤镜） ---
    const args = [
      '-framerate', '1',         // 必须在 -i 之前
      '-start_number', '000',     // 从 000 开始
      '-i', 'input%03d.png',
      
      // 暴力测试：暂时只用简单的缩放，排除 palettegen 耗尽内存的问题
      '-vf', 'scale=320:-1:flags=lanczos', 
      
      '-y',                       // 覆盖输出
      'output.gif'
    ];

    // 如果上面简化指令通过了，你再把 VIP 的滤镜逻辑换回来试
    // '-vf', isVip 
    //   ? 'split[a][b];[a]palettegen[p];[b][p]paletteuse' 
    //   : 'scale=320:-1:flags=lanczos,boxblur=1:1,split[a][b];[a]palettegen[p];[b][p]paletteuse',

    console.log('当前 FS 文件列表（核心检查）：', await ffmpeg.listDir('.'));

    // 执行
    await ffmpeg.exec(args); 

    // 5. 读取结果
    const data = await ffmpeg.readFile('output.gif');
    
    // 强制转换为 Uint8Array 以便访问 byteLength
    const uint8Data = data as Uint8Array;
    console.log('生成的 GIF 大小:', uint8Data.byteLength);

    // --- 重点：修复 build 报错的写法 ---
    // 使用一个通用的数组包装，并显式断言为 any 绕过 BlobPart 的兼容性检查
    // 或者使用数据拷贝来确保它不是 SharedArrayBuffer
    const blob = new Blob([uint8Data.buffer as ArrayBuffer], { type: 'image/gif' });
    
    // 如果上面的写法还报错，请尝试这个最暴力的“拷贝法”：
    // const safeData = new Uint8Array(uint8Data); 
    // const blob = new Blob([safeData], { type: 'image/gif' });

    return URL.createObjectURL(blob);
  };
  return { isLoaded, progress, loadFFmpeg, generateGif };
}