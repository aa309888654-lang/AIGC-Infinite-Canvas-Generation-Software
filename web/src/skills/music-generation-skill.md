# Music Generation Skill

## 技能描述
AI音乐生成技能包，提供背景音乐生成、音效设计、音频混音等专业能力。支持多种风格和情绪，适用于视频配乐、游戏音乐、广告BGM等场景。

## 能力清单

### 1. 背景音乐生成
- **风格多样**: 史诗、平静、戏剧、浪漫、喜剧、动作、环境
- **情绪匹配**: 积极、消极、中性
- **时长控制**: 5-180秒
- **乐器选择**: 钢琴、弦乐、鼓、吉他等

### 2. 音效设计
- **UI音效**: 按钮、通知、切换
- **转场音效**: 场景切换过渡
- **环境音**: 自然、城市、办公室
- **撞击音**: 打击、碰撞、爆炸

### 3. 音频混音
- **多轨混音**: 混合多个音频轨道
- **淡入淡出**: 渐强渐弱效果
- **音量平衡**: 调整各轨道音量
- **标准化**: 音频响度标准化

### 4. 循环音乐
- **片段循环**: 无缝循环
- **交叉淡入**: 平滑过渡
- **BPM同步**: 配合节奏

### 5. 音乐分析
- **情绪识别**: 分析音乐情绪
- **节拍检测**: 检测 BPM
- **和弦分析**: 和弦进行分析

## 使用方法

### 生成背景音乐

```typescript
interface MusicGenerationParams {
  style: 'epic' | 'peaceful' | 'dramatic' | 'romantic' | 'comedic' | 'action' | 'ambient';
  mood: 'upbeat' | 'downbeat' | 'neutral';
  duration: number; // seconds
  instruments?: string[];
  prompt?: string;
  seed?: number;
}

async function generateBackgroundMusic(
  params: MusicGenerationParams
): Promise<MusicTrack> {
  const response = await musicAPI.generate({
    model: 'music-gen-v1',
    input: {
      prompt: buildMusicPrompt(params),
      duration: params.duration,
      sample_rate: 44100,
    },
  });

  return {
    id: response.task_id,
    url: response.audio_url,
    duration: params.duration,
    type: 'music',
  };
}

function buildMusicPrompt(params: MusicGenerationParams): string {
  const parts = [params.style];

  if (params.mood) parts.push(params.mood);
  if (params.instruments?.length) parts.push(params.instruments.join(', '));
  if (params.prompt) parts.push(params.prompt);

  return parts.join(', ');
}

// 使用示例
const bgMusic = await generateBackgroundMusic({
  style: 'epic',
  mood: 'neutral',
  duration: 60,
  instruments: ['piano', 'strings', 'drums'],
  prompt: 'cinematic, movie score',
});
```

### 生成音效

```typescript
interface SoundEffectParams {
  type: 'transition' | 'notification' | 'ambient' | 'impact' | 'ui';
  duration?: number;
  intensity?: number; // 0-1
}

async function generateSoundEffect(
  params: SoundEffectParams
): Promise<SoundEffect> {
  const presetMap = {
    transition: { prompt: 'whoosh, smooth transition', duration: 0.5 },
    notification: { prompt: 'soft chime, notification', duration: 1.0 },
    ambient: { prompt: 'ambient background, subtle', duration: 5.0 },
    impact: { prompt: 'strong impact, hit', duration: 0.3 },
    ui: { prompt: 'UI click, button', duration: 0.2 },
  };

  const preset = presetMap[params.type];

  return musicAPI.generateSFX({
    prompt: preset.prompt,
    duration: params.duration || preset.duration,
    intensity: params.intensity || 0.8,
  });
}
```

### 音频混音

```typescript
interface MixParams {
  tracks: Array<{
    url: string;
    volume: number; // 0-1
    startTime: number; // seconds
    duration?: number;
    fadeIn?: number; // seconds
    fadeOut?: number; // seconds
  }>;
  outputFormat: 'mp3' | 'wav' | 'aac';
  bitrate?: number;
  normalize?: boolean;
}

async function mixAudio(params: MixParams): Promise<string> {
  // 1. 准备轨道
  const preparedTracks = await Promise.all(
    params.tracks.map(async (track, index) => {
      // 应用淡入淡出
      const processed = await applyAudioEffects(track);
      return {
        ...processed,
        index,
        originalUrl: track.url,
      };
    })
  );

  // 2. 时间对齐
  const alignedTracks = alignTracks(preparedTracks, params.tracks);

  // 3. 混音合成
  const mixedUrl = await audioAPI.mix(alignedTracks, {
    outputFormat: params.outputFormat,
    bitrate: params.bitrate || 192,
    normalize: params.normalize ?? true,
  });

  return mixedUrl;
}

async function applyAudioEffects(
  track: MixParams['tracks'][0]
): Promise<AudioBuffer> {
  // 应用淡入
  if (track.fadeIn) {
    await applyFade(track.url, 0, track.fadeIn, 'in');
  }

  // 应用淡出
  if (track.fadeOut) {
    await applyFade(track.url, track.startTime, track.fadeOut, 'out');
  }

  // 应用音量
  return await applyVolume(track.url, track.volume);
}
```

## 示例

### 示例 1: 视频背景音乐

```typescript
// 视频场景：温馨的家庭时刻
const homeSceneMusic = await generateBackgroundMusic({
  style: 'peaceful',
  mood: 'upbeat',
  duration: 45,
  instruments: ['piano', 'acoustic guitar', 'soft strings'],
  prompt: 'heartwarming, family, cozy',
});

// 添加环境音
const ambient = await generateSoundEffect({
  type: 'ambient',
  duration: 45,
  intensity: 0.3,
});

// 混音
const finalMusic = await mixAudio({
  tracks: [
    { url: homeSceneMusic.url, volume: 0.8, startTime: 0 },
    { url: ambient.url, volume: 0.2, startTime: 0 },
  ],
  outputFormat: 'mp3',
  normalize: true,
});
```

### 示例 2: 游戏背景音乐

```typescript
// 游戏关卡：战斗场景
const battleMusic = await generateBackgroundMusic({
  style: 'action',
  mood: 'upbeat',
  duration: 120,
  instruments: ['drums', 'electric guitar', 'synth'],
  prompt: 'intense, epic battle, high energy',
  seed: 12345,
});

// 创建循环版本
const loopedMusic = await createLoop(battleMusic.url, {
  repeatCount: 0, // 无限循环
  crossfadeDuration: 2,
});
```

### 示例 3: UI 音效包

```typescript
const uiSoundPack = {
  button: await generateSoundEffect({ type: 'ui', duration: 0.15 }),
  notification: await generateSoundEffect({ type: 'notification', duration: 0.8 }),
  transition: await generateSoundEffect({ type: 'transition', duration: 0.4 }),
  success: await generateSoundEffect({ type: 'impact', duration: 0.3, intensity: 0.7 }),
  error: await generateSoundEffect({ type: 'impact', duration: 0.4, intensity: 0.9 }),
};

// 导出为音效包
const soundPack = {
  version: '1.0',
  format: 'mp3',
  sounds: uiSoundPack,
};
```

### 示例 4: 视频配乐节奏匹配

```typescript
// 分析视频节奏
const videoBPM = await detectVideoBPM(videoUrl);

// 生成匹配的音乐
const matchedMusic = await generateBackgroundMusic({
  style: 'dramatic',
  mood: 'neutral',
  duration: videoDuration,
  instruments: ['piano', 'strings'],
  prompt: `bpm ${videoBPM}, rhythmic`,
});

// 创建时间轴
const musicTimeline = await createTimeline(matchedMusic.url, [
  { time: 0, section: 'intro' },
  { time: 10, section: 'verse' },
  { time: 25, section: 'chorus' },
  { time: 45, section: 'outro' },
]);
```

## 最佳实践

1. **风格匹配**
   - 音乐风格需与内容匹配
   - 注意情绪一致性
   - 避免风格冲突

2. **音量控制**
   - BGM 音量适中 (20-40%)
   - 留出语音空间
   - 避免突兀

3. **循环处理**
   - 使用交叉淡入避免跳跃
   - 选择适合循环的段落
   - 测试无缝循环效果

4. **输出格式**
   - 视频用 MP3 或 AAC
   - 高质量需求用 WAV
   - 考虑文件大小

## 注意事项

- 版权和商用授权
- 音乐长度与内容匹配
- 混音中的版权音乐
- 响度标准化
