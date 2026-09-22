# Video Editing Skill

## 技能描述
专业视频编辑技能包，提供完整的视频剪辑知识体系，包括剪辑理论、转场效果、音频处理、字幕生成、色彩校正、特效合成等。支持 FFmpeg 命令行操作和脚本自动化，适用于批量视频处理和复杂剪辑工作。

## 能力清单

### 1. 视频剪辑基础
- 剪切 (Cut): 在指定时间点分割视频
- 裁剪 (Crop): 调整视频画面尺寸
- 缩放 (Scale): 改变视频分辨率
- 旋转 (Rotate): 旋转视频画面
- 拼接 (Concatenate): 合并多个视频片段

### 2. 转场效果
- **基础转场**
  - fade: 淡入淡出
  - dissolve: 溶解
  - wipe: 划像
  - slide: 滑动
- **高级转场**
  - blur: 模糊转场
  - zoom: 缩放转场
  - glitch: 故障转场
  - rgb-split: RGB分离转场

### 3. 音频处理
- 音量调整 (Volume)
- 音频淡入淡出 (Audio Fade)
- 音频混合 (Audio Mix)
- 降噪 (Noise Reduction)
- 音频提取 (Audio Extract)

### 4. 字幕生成
- SRT 字幕处理
- VTT 字幕处理
- ASS 字幕样式
- 字幕位置调整
- 字幕翻译

### 5. 色彩校正
- 亮度/对比度调整
- 饱和度调整
- 色温调整
- 曲线调整
- LUT 应用

### 6. 特效合成
- 水印添加
- 画中画
- 绿幕抠像
- 模糊背景
- 文字叠加

## 使用方法

### FFmpeg 基本命令

```bash
# 剪切视频
ffmpeg -i input.mp4 -ss 00:00:10 -t 00:00:05 -c copy output.mp4

# 合并视频
ffmpeg -f concat -i filelist.txt -c copy output.mp4

# 添加转场
ffmpeg -i video1.mp4 -i video2.mp4 -filter_complex "xfade=transition=fade:duration=1:offset=5" output.mp4

# 提取音频
ffmpeg -i input.mp4 -vn -acodec libmp3lame -q:a 2 output.mp3

# 生成字幕
ffmpeg -i input.mp4 -vf "subtitles=subtitle.srt" output.mp4
```

### 在 Node 中的使用

```typescript
import { spawn } from 'child_process';

// 执行 FFmpeg 命令
function runFFmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);
    let output = '';
    let errorOutput = '';

    ffmpeg.stdout.on('data', (data) => { output += data; });
    ffmpeg.stderr.on('data', (data) => { errorOutput += data; });

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(errorOutput));
    });
  });
}

// 剪切视频
async function cutVideo(input: string, output: string, start: number, duration: number) {
  return runFFmpeg([
    '-i', input,
    '-ss', start.toString(),
    '-t', duration.toString(),
    '-c', 'copy',
    output
  ]);
}
```

## 示例

### 示例 1: 添加淡入淡出效果

```bash
ffmpeg -i input.mp4 -vf "fade=t=in:st=0:d=1,fade=t=out:st=9:d=1" -c:a copy output.mp4
```

### 示例 2: 画中画效果

```bash
ffmpeg -i main.mp4 -i overlay.mp4 -filter_complex "[1:v]scale=320:180 [pip]; [0:v][pip] overlay=main_w-overlay_w-10:main_h-overlay_h-10" output.mp4
```

### 示例 3: 批量转码

```bash
for f in *.mp4; do ffmpeg -i "$f" -c:v libx264 -crf 23 -c:a aac -b:a 128k "encoded/$f"; done
```

### 示例 4: 提取关键帧

```bash
ffmpeg -i input.mp4 -vf "select='eq(pict_type,PICT_TYPE_I)'" -vsync vfr -q:v 2 output_%03d.jpg
```

## 最佳实践

1. **使用硬件加速**: 利用 GPU 加速视频处理
   ```bash
   ffmpeg -i input.mp4 -c:v h264_nvenc output.mp4
   ```

2. **保持原始质量**: 使用 stream copy 避免重新编码
   ```bash
   ffmpeg -i input.mp4 -c copy -ss 10 -t 5 output.mp4
   ```

3. **批量处理**: 使用脚本自动化重复任务

4. **监控进度**: 使用 FFmpeg 的 progress 选项
   ```bash
   ffmpeg -i input.mp4 -progress progress.txt output.mp4
   ```

## 注意事项

- 视频编码格式会影响处理速度
- 大量视频处理时注意磁盘 I/O
- 音频和视频编码参数需要匹配
- 转场效果需要合理的重叠时间
