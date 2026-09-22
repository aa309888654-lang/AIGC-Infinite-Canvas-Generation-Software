# Voice Over Skill

## 技能描述
AI配音技能包，提供文字转语音、音色选择、情感调节等专业配音能力。支持多语言、多角色配音，适用于视频配音、旁白解说、游戏角色等多种场景。

## 能力清单

### 1. 文字转语音 (TTS)
- **多语言支持**: 中文、英文、日文、韩文等
- **自然度优化**: 高保真语音合成
- **专业术语**: 准确发音专业词汇
- **标点处理**: 智能处理停顿和语调

### 2. 音色选择
- **预设音色**: 多种预设音色可选
- **自定义音色**: 支持音色克隆
- **角色匹配**: 根据角色选择合适音色
- **年龄性别**: 不同年龄和性别的声音

### 3. 情感调节
- **基础情感**: 中性、开心、悲伤、愤怒、兴奋
- **情感强度**: 0-100% 强度控制
- **渐进变化**: 情感渐进过渡
- **混合情感**: 多种情感组合

### 4. 多角色配音
- **角色映射**: 为每个角色分配音色
- **对话切换**: 自动识别角色切换
- **混音处理**: 多角色音频混合
- **音量平衡**: 保持音量一致

### 5. 音频处理
- **语速调整**: 0.5x - 2.0x
- **音高调整**: -10 到 +10
- **音量调整**: 0-100%
- **降噪处理**: 清除背景噪音

### 6. 视频同步
- **音画对齐**: 精确同步
- **口型同步**: 匹配口型动作
- **节奏匹配**: 配合画面节奏
- **时间轴编辑**: 精确时间控制

## 使用方法

### 基本文字转语音

```typescript
interface TTSParams {
  provider: 'azure' | 'elevenlabs' | 'baidu' | 'aliyun' | 'minimax';
  text: string;
  voiceId: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited';
}

async function textToSpeech(params: TTSParams): Promise<string> {
  const result = await voiceAPI.synthesize(params);
  return result.audioUrl;
}

// 使用示例
const audioUrl = await textToSpeech({
  provider: 'minimax',
  text: '你好，欢迎观看我的视频',
  voiceId: 'minimax-zh-female-young',
  speed: 1.0,
  pitch: 0,
  volume: 1.0,
  emotion: 'happy',
});
```

### 多角色配音

```typescript
interface CharacterVoiceMapping {
  characterId: string;
  characterName: string;
  voiceConfig: {
    voiceId: string;
    volume: number;
  };
  dialogueSegments: Array<{
    text: string;
    startTime: number;
    endTime: number;
  }>;
}

async function synthesizeMultiCharacterVoice(
  mappings: CharacterVoiceMapping[]
): Promise<string> {
  const audioTracks: string[] = [];

  for (const mapping of mappings) {
    const audioUrl = await textToSpeech({
      provider: 'minimax',
      text: mapping.dialogueSegments.map(s => s.text).join(' '),
      voiceId: mapping.voiceConfig.voiceId,
    });

    audioTracks.push(audioUrl);
  }

  // 混音
  return mixAudioTracks(audioTracks, mappings);
}
```

### 情感调节

```typescript
interface EmotionParams {
  baseEmotion: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited';
  targetEmotion: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited';
  intensity: number; // 0-1
  transitionDuration: number; // seconds
}

function adjustEmotion(params: EmotionParams): EmotionConfig {
  const emotionMatrix = {
    neutral: { pitchShift: 0, speedMultiplier: 1.0, timbreShift: 0 },
    happy: { pitchShift: 2, speedMultiplier: 1.1, timbreShift: 1 },
    sad: { pitchShift: -2, speedMultiplier: 0.9, timbreShift: -1 },
    angry: { pitchShift: 1, speedMultiplier: 1.2, timbreShift: 2 },
    excited: { pitchShift: 3, speedMultiplier: 1.15, timbreShift: 2 },
  };

  const source = emotionMatrix[params.baseEmotion];
  const target = emotionMatrix[params.targetEmotion];

  return {
    pitchShift: lerp(source.pitchShift, target.pitchShift, params.intensity),
    speedMultiplier: lerp(source.speedMultiplier, target.speedMultiplier, params.intensity),
    timbreShift: lerp(source.timbreShift, target.timbreShift, params.intensity),
    transitionDuration: params.transitionDuration,
  };
}
```

## 示例

### 示例 1: 视频配音

```typescript
const video配音任务 = {
  videoDuration: 60,
  script: [
    { character: '旁白', text: '很久很久以前...', startTime: 0 },
    { character: '角色A', text: '你好！', startTime: 3 },
    { character: '角色B', text: '你好啊！', startTime: 5 },
  ],
  characters: {
    '旁白': { voiceId: 'minimax-zh-male', emotion: 'neutral' },
    '角色A': { voiceId: 'minimax-zh-female-young', emotion: 'happy' },
    '角色B': { voiceId: 'minimax-zh-female-adult', emotion: 'happy' },
  },
};

// 生成配音
const audioTracks = await Promise.all(
  Object.entries(video配音任务.characters).map(([name, config]) =>
    textToSpeech({
      provider: 'minimax',
      text: video配音任务.script
        .filter(s => s.character === name)
        .map(s => s.text)
        .join(' '),
      voiceId: config.voiceId,
      emotion: config.emotion,
    })
  )
);

// 混音合成
const finalAudio = await mixAndSync(video配音任务.script, audioTracks);
```

### 示例 2: 旁白解说

```typescript
const narrationConfig = {
  text: '本视频介绍人工智能的发展历史...',
  style: 'documentary',
  pace: 'moderate', // slow, moderate, fast
  voiceId: 'minimax-zh-male-professional',
};

const narration = await textToSpeech({
  ...narrationConfig,
  pitch: 0,
  speed: narrationConfig.pace === 'slow' ? 0.9 :
          narrationConfig.pace === 'fast' ? 1.1 : 1.0,
  emotion: 'neutral',
});
```

### 示例 3: 游戏角色配音

```typescript
const gameCharacters = [
  {
    id: 'hero',
    name: 'Hero',
    emotion: 'excited',
    dialogues: [
      { text: 'I will save the world!', timestamp: 0 },
      { text: 'Take that!', timestamp: 5 },
    ],
  },
  {
    id: 'villain',
    name: 'Villain',
    emotion: 'angry',
    dialogues: [
      { text: 'You cannot defeat me!', timestamp: 2 },
      { text: 'Nooooo!', timestamp: 8 },
    ],
  },
];

// 为每个角色生成配音
const gameAudio = await Promise.all(
  gameCharacters.map(char =>
    textToSpeech({
      provider: 'elevenlabs',
      text: char.dialogues.map(d => d.text).join(' '),
      voiceId: getVoiceIdForCharacter(char.id),
      emotion: char.emotion,
      speed: char.emotion === 'excited' ? 1.2 : 1.0,
    })
  )
);
```

## 最佳实践

1. **选择合适的音色**
   - 考虑角色年龄和性格
   - 匹配应用场景
   - 保持一致性

2. **调整语速和节奏**
   - 根据内容调整速度
   - 保持自然停顿
   - 避免过快或过慢

3. **情感表达**
   - 根据内容选择情感
   - 避免过度情感化
   - 保持真实感

4. **音频后期处理**
   - 降噪处理
   - 音量标准化
   - 添加混响效果

## 注意事项

- 不同 TTS 提供商质量不同
- 情感调节需要适度
- 多角色配音需要预审
- 版权和合规性检查
