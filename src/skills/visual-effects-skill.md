# AI视觉特效技能

## 技能描述
专业的视觉特效节点开发技能，支持粒子系统、滤镜、故障效果、转场、发光等多种视觉特效处理。

## 能力清单

### 1. 粒子系统 (Particle System)
- **火焰**: 逼真的火焰燃烧效果
- **烟雾**: 烟雾飘散效果
- **雨滴**: 电影级雨滴下落
- **雪花**: 柔和的雪花飘落
- **火花**: 金属碰撞火花
- **魔法**: 梦幻粒子特效
- **自定义**: 自定义粒子类型

### 2. 图像滤镜 (Filters)
- **复古滤镜**: 胶片色调、漏光、划痕
- **黑白电影**: 高对比度黑白效果
- **青橙色调**: 电影级青橙调色
- **赛博朋克**: 霓虹色调
- **蒸汽波**: 80年代复古未来

### 3. 故障特效 (Glitch Effects)
- **数字故障**: RGB分离、噪点、扫描线
- **数据损坏**: 视频压缩损坏效果
- **模拟故障**: 复古VHS风格

### 4. 发光特效 (Glow Effects)
- **霓虹发光**: 霓虹灯光效果
- **全息投影**: 科幻全息效果
- **光晕**: 柔和光晕效果

### 5. 扭曲效果 (Distortion)
- **波浪扭曲**: 水波纹效果
- **缩放模糊**: 缩放过渡效果
- **鱼眼**: 镜头扭曲
- **万花筒**: 对称扭曲

### 6. 转场效果 (Transitions)
- **时空扭曲**: 时空穿越转场
- **故障转场**: 数字故障转场
- **模糊转场**: 运动模糊转场

### 7. 色彩调校 (Color Grading)
- **LUT应用**: 电影LUT预设
- **曲线调整**: RGB曲线控制
- **色温色调**: 白平衡调整
- **分离色调**: 高光/阴影着色

## 特效参数指南

### 粒子特效参数
```typescript
{
  type: 'fire' | 'smoke' | 'rain' | 'snow' | 'sparks' | 'custom',
  count: 100,           // 粒子数量
  size: { min: 1, max: 10 },  // 粒子大小范围
  speed: { min: 1, max: 5 },  // 速度范围
  direction: { x: 0, y: -1 }, // 方向向量
  colors: ['#ff4400', '#ff6600', '#ffaa00'], // 颜色数组
  lifetime: 2,         // 生命周期（秒）
  gravity: -0.5,       // 重力影响
  turbulence: 0.3,     // 湍流强度
  blending: 'additive'  // 混合模式
}
```

### 滤镜特效参数
```typescript
{
  type: 'vintage' | 'noir' | 'cinematic' | 'vaporwave',
  intensity: 0.8,      // 效果强度 0-1
  parameters: {
    grain: 0.3,       // 颗粒度
    vignette: 0.4,     // 暗角强度
    sepia: 0.2,        // 棕褐色调
    fade: 0.1,         // 褪色
  }
}
```

### 故障特效参数
```typescript
{
  type: 'digital' | 'datamosh' | 'analog',
  intensity: 0.7,      // 效果强度
  rgbSplit: 10,        // RGB分离程度
  scanlines: 0.4,      // 扫描线强度
  noise: 0.3,          // 噪点强度
  blockSize: 20,       // 块大小
  blockGlitch: true,   // 是否启用块故障
}
```

### 发光特效参数
```typescript
{
  color: '#ff00ff',    // 发光颜色
  intensity: 1.5,       // 发光强度
  radius: 12,          // 发光半径
  threshold: 0.5,       // 发光阈值
  technique: 'bloom' | 'outer' | 'inner'
}
```

## 使用方法

### 1. 应用粒子特效
```typescript
const result = await agent.execute({
  type: 'particle-system',
  params: {
    type: 'fire',
    count: 150,
    colors: ['#ff4400', '#ff6600', '#ffaa00'],
    intensity: 0.8,
    speed: { min: 2, max: 5 },
    gravity: -0.3,
  }
});
```

### 2. 应用滤镜
```typescript
const result = await agent.execute({
  type: 'filter',
  params: {
    filterType: 'cinematic',
    intensity: 0.8,
    parameters: {
      shadowsColor: '#0088aa',
      highlightsColor: '#ff8844',
      contrast: 0.15,
    }
  }
});
```

### 3. 应用故障效果
```typescript
const result = await agent.execute({
  type: 'glitch',
  params: {
    glitchType: 'digital',
    intensity: 0.7,
    rgbSplit: 10,
    scanlines: 0.4,
    noise: 0.3,
  }
});
```

### 4. 创建转场
```typescript
const result = await agent.execute({
  type: 'transition',
  params: {
    transitionType: 'warp',
    duration: 0.8,
    parameters: {
      direction: 'center',
      distortion: 0.7,
    }
  }
});
```

### 5. 复合特效链
```typescript
const result = await agent.execute({
  type: 'composite',
  params: {
    layers: [
      { type: 'image', source: 'background.jpg', opacity: 1 },
      { type: 'effect', effectId: 'glow-neon', params: { color: '#ff00ff' } },
      { type: 'effect', effectId: 'glitch', params: { intensity: 0.3 } },
    ]
  }
});
```

## 特效预设

### 电影胶片预设
```
1. 复古胶片:
   - vintage滤镜 intensity=0.7
   - grain=0.25
   - vignette=0.35
   - sepia=0.15

2. 青橙色调:
   - cinematic滤镜
   - shadowsColor=#0088aa
   - highlightsColor=#ff8844
```

### 赛博朋克预设
```
1. 霓虹城市:
   - vaporwave滤镜 saturation=1.4
   - digital故障 intensity=0.3
   - 霓虹发光 color=#ff00ff intensity=1.0
   - 扫描线 intensity=0.15

2. 全息投影:
   - holographic发光 color=#00ffff
   - 轻微故障 intensity=0.2
```

### 梦幻效果预设
```
1. 魔法氛围:
   - 魔法粒子 count=100 turbulence=1.0
   - 柔和发光 color=#ffeedd
   - 暖色调 temperature=0.15

2. 雨天情绪:
   - 雨滴粒子 angle=15 intensity=0.9
   - 冷色调 temperature=-0.2
   - 轻微模糊
```

## 最佳实践

### 1. 性能优化
- 粒子数量控制在 200 以内效果最佳
- 复杂特效链可分段渲染
- 使用 GPU 加速选项

### 2. 视觉效果
- 结合多种特效时注意层次
- 发光效果配合深色背景更佳
- 故障效果适度使用更有效

### 3. 兼容性
- 视频特效需考虑帧率
- 转场时长根据内容调整
- 滤镜强度不宜过高

## API 端点

| 功能 | 端点 | 方法 |
|------|------|------|
| 应用特效 | /api/effects/apply | POST |
| 粒子系统 | /api/effects/particles | POST |
| 滤镜 | /api/effects/filter | POST |
| 故障 | /api/effects/glitch | POST |
| 发光 | /api/effects/glow | POST |
| 转场 | /api/effects/transition | POST |
| 色彩调校 | /api/effects/color-grade | POST |
| 复合效果 | /api/effects/composite | POST |

## 特效节点类型

| 节点类型 | 功能 | 位置 |
|----------|------|------|
| ParticleEffect | 粒子特效 | effects/particle |
| FilterNode | 图像滤镜 | effects/filter |
| GlitchNode | 故障特效 | effects/glitch |
| GlowNode | 发光特效 | effects/glow |
| DistortNode | 扭曲效果 | effects/distort |
| TransitionNode | 转场效果 | effects/transition |
| ColorGrade | 色彩调校 | effects/color |
| CompositeNode | 复合效果 | effects/composite |
