# 豆包 Seedream 5.0 Pro 开发技能

## 技能描述
豆包 Seedream 5.0 Pro 多模态图像生成专家技能，支持文生图、图像变体、多图输入等高级功能。

## 模型信息

| 属性 | 值 |
|------|-----|
| 模型名称 | 豆包 Seedream 5.0 Pro |
| 模型 ID | doubao-seedream-5-0-pro |
| 提供商 | 豆包 |
| 类型 | 多模态图像生成 |
| API | 豆包图像生成 API |

## 能力清单

### 1. 文生图 (Text-to-Image)
- 高质量图像生成
- 支持多种宽高比
- 风格控制（生动/自然）
- 质量等级选择

### 2. 图像变体 (Image Variations)
- 基于原图生成多个变体
- 保持主题一致性
- 可添加补充描述

### 3. 图像编辑 (Image Editing)
- 局部重绘（需配合遮罩）
- 风格调整
- 场景扩展

### 4. 多图组合 (Multi-Image)
- 多张参考图组合
- 构图控制
- 风格混合

## 支持的尺寸

| 尺寸 | 宽高比 | 用途 |
|------|--------|------|
| 256×256 | 1:1 | 快速预览 |
| 512×512 | 1:1 | 社交媒体 |
| 1024×1024 | 1:1 | 高质量输出 |
| 1024×1792 | 9:16 | 竖版内容 |
| 1792×1024 | 16:9 | 横版内容 |

## 风格选项

### Vivid（生动）
- 更加鲜艳和戏剧性
- 适合艺术创作
- 色彩饱和度高
- 对比度强

### Natural（自然）
- 更加自然和逼真
- 适合产品展示
- 色彩还原度高
- 光影自然

## 质量等级

| 等级 | 生成时间 | 质量 | 用途 |
|------|----------|------|------|
| Low | 1-2s | 较低 | 快速预览 |
| Medium | 3-5s | 标准 | 一般用途 |
| High | 5-10s | 最高 | 最终输出 |

## 使用方法

### 1. 基本文生图
```typescript
const result = await agent.execute({
  type: 'text-to-image',
  params: {
    prompt: 'A beautiful sunset over the ocean with palm trees',
    size: '1024x1024',
    quality: 'high',
    style: 'vivid',
    n: 1,
  }
});
```

### 2. 生成多个变体
```typescript
const result = await agent.execute({
  type: 'image-variation',
  params: {
    image: 'https://example.com/photo.jpg',
    size: '1024x1024',
    n: 4,
  }
});
```

### 3. 批量生成
```typescript
const result = await agent.execute({
  type: 'batch-generate',
  params: {
    prompts: [
      'A cat sitting on a windowsill',
      'A dog playing in the park',
      'A bird flying in the sky',
    ],
    size: '1024x1024',
    quality: 'medium',
    style: 'natural',
  }
});
```

### 4. 风格迁移
```typescript
const result = await agent.execute({
  type: 'style-transfer',
  params: {
    image: 'https://example.com/photo.jpg',
    prompt: 'Convert to impressionist painting style',
    style: 'vivid',
  }
});
```

## 提示词编写技巧

### 优质提示词结构
```
[主体] + [场景/环境] + [动作/状态] + [光线/氛围] + [风格/质量]
```

### 示例
```
Professional portrait photograph of a young woman in a flower garden,
soft golden hour lighting, gentle smile, bokeh background,
cinematic composition, ultra detailed, 8k quality
```

### 分步描述法
1. **主体**: 谁/什么
2. **细节**: 外观特征
3. **场景**: 在哪里
4. **光线**: 什么光照
5. **风格**: 什么感觉
6. **质量**: 什么水平

## API 端点

| 功能 | 端点 | 方法 |
|------|------|------|
| 文生图 | /api/image/doubao-seedream-5-0-pro/generate | POST |
| 图像变体 | /api/image/doubao-seedream-5-0-pro/variation | POST |
| 图像编辑 | /api/image/doubao-seedream-5-0-pro/edit | POST |
| 风格迁移 | /api/image/doubao-seedream-5-0-pro/style-transfer | POST |

## 节点类型

| 节点 | 功能 | 位置 |
|------|------|------|
| doubaoSeedreamInput | 图片输入 | 输入 |
| doubaoSeedreamGen | 图片生成 | 处理 |
| doubaoSeedreamVariation | 变体生成 | 处理 |
| doubaoSeedreamEdit | 图像编辑 | 处理 |
| doubaoSeedreamComposite | 图像组合 | 处理 |

## 最佳实践

1. **尺寸选择**
   - 社交媒体: 1024×1024
   - 故事内容: 1024×1792 (9:16)
   - 横幅广告: 1792×1024 (16:9)

2. **风格选择**
   - 艺术创作: Vivid
   - 产品展示: Natural
   - 概念设计: Vivid

3. **质量平衡**
   - 预览: Low
   - 日常使用: Medium
   - 最终输出: High

4. **API 调用**
   - 批量生成建议并行
   - 注意速率限制
   - 做好错误处理
