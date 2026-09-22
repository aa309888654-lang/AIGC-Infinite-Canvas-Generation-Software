# AI图片生成技能

## 技能描述
专业的AI图片生成节点开发技能，支持文生图、图生图、智能补全、风格迁移等多种图片生成能力。

## 能力清单

### 1. 文生图 (Text-to-Image)
- 支持多种主流模型：FLUX Pro、DALL-E 3、Midjourney V6、SDXL、通义万相
- 灵活的风格选择：写实摄影、动漫、油画、水彩、数字艺术等
- 可调参数：分辨率、步数、引导系数、种子值

### 2. 图生图 (Image-to-Image)
- 基于参考图片生成新图
- 可调节变换强度
- 支持局部重绘

### 3. 智能补全 (Inpainting/Outpainting)
- **Inpainting**: 智能局部重绘，修改指定区域
- **Outpainting**: 智能向外扩展，延伸画面边界

### 4. 风格迁移 (Style Transfer)
- 将艺术风格应用到图片
- 预设风格：油画、水彩、赛博朋克、电影感等

### 5. 图片增强
- 超分辨率放大 (2x, 4x)
- 人脸增强
- 背景移除

## 支持的模型

| 模型 | 提供商 | 文生图 | 图生图 | 局部重绘 | 风格迁移 |
|------|--------|--------|--------|----------|----------|
| FLUX Pro | BlackForest | ✓ | ✓ | ✓ | - |
| DALL-E 3 | OpenAI | ✓ | ✓ | ✓ | - |
| Midjourney V6 | Midjourney | ✓ | ✓ | - | - |
| SDXL | Stability AI | ✓ | ✓ | ✓ | ✓ |
| 通义万相 | 阿里云 | ✓ | ✓ | ✓ | ✓ |

## 风格预设

### 摄影风格
- **写实摄影**: photorealistic, 8k, ultra detailed
- **电影感**: cinematic, film grain, dramatic lighting
- **人像**: portrait photography, professional lighting

### 艺术风格
- **动漫风格**: anime style, cel shading, vibrant colors
- **油画**: oil painting, masterpiece, classical art
- **水彩**: watercolor painting, fluid, artistic
- **数字艺术**: digital art, illustration, detailed

### 特色风格
- **赛博朋克**: cyberpunk, neon lights, futuristic
- **奇幻**: fantasy, magical, ethereal

## 使用方法

### 1. 基本文生图
```typescript
const result = await agent.execute({
  type: 'text-to-image',
  params: {
    prompt: 'A beautiful sunset over the ocean',
    model: 'flux-pro',
    style: 'photorealistic',
    aspectRatio: '16:9',
  }
});
```

### 2. 图生图
```typescript
const result = await agent.execute({
  type: 'image-to-image',
  params: {
    prompt: 'Transform to anime style',
    sourceImage: 'https://example.com/photo.jpg',
    model: 'wanx',
    strength: 0.7,
  }
});
```

### 3. 局部重绘
```typescript
const result = await agent.execute({
  type: 'inpainting',
  params: {
    prompt: 'Replace with a cat',
    sourceImage: 'https://example.com/photo.jpg',
    mask: 'base64-encoded-mask',
    model: 'flux-pro',
  }
});
```

## 提示词编写指南

### 优质提示词结构
1. **主体描述**: 谁/什么在画面中
2. **场景设定**: 在哪里/什么环境
3. **动作/姿态**: 做什么/怎么样
4. **光线**: 光源方向和质量
5. **风格**: 艺术风格或参考
6. **质量词**: 8k, detailed, professional

### 示例
```
A young woman in elegant dress standing in a flower garden,
soft golden hour lighting, gentle breeze, 
cinematic photography, bokeh background,
8k resolution, highly detailed, professional quality
```

### 负面提示词
```
blurry, low quality, deformed, distorted,
watermark, text, logo, extra limbs,
bad anatomy, bad proportions, ugly
```

## 最佳实践

1. **分辨率选择**
   - 方形 (1:1) 适合社交媒体
   - 宽屏 (16:9) 适合视频封面
   - 竖屏 (9:16) 适合手机壁纸

2. **步数和引导系数**
   - 快速预览: steps=20, guidance=3
   - 标准质量: steps=30, guidance=7
   - 高质量: steps=50, guidance=10

3. **种子值**
   - 使用固定种子可复现结果
   - 随机种子 (-1) 获取不同变体

## API 端点

| 功能 | 端点 |
|------|------|
| 文生图 | POST /api/image/generate |
| 图生图 | POST /api/image/generate (mode: image-to-image) |
| 局部重绘 | POST /api/image/inpaint |
| 风格迁移 | POST /api/image/style-transfer |
| 超分辨率 | POST /api/image/upscale |

## 错误处理

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| 400 | 参数错误 | 检查 prompt 和参数格式 |
| 401 | 认证失败 | 检查 API 密钥 |
| 429 | 请求过多 | 降低请求频率 |
| 500 | 服务器错误 | 重试或联系支持 |
