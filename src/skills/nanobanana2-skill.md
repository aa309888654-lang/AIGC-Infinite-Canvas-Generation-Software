# 豆包 Seedream 5.0 lite 开发技能

## 技能描述
高性能轻量级 AI 图像生成专家技能，支持文生图、图生图、局部重绘、ControlNet、Lora等多种功能。

## 模型信息

| 属性 | 值 |
|------|-----|
| 模型名称 | 豆包 Seedream 5.0 lite |
| 模型 ID | doubao-seedream-5-0-lite |
| 提供商 | 豆包 |
| 版本 | 2.0 |
| 类型 | 轻量级云端推理 |
| 加速支持 | ONNX/TensorRT/OpenVINO/CoreML |

## 能力清单

### 1. 文生图 (Text-to-Image)
- 高速推理
- 低显存占用
- 批量生成支持
- 多种采样器

### 2. 图生图 (Image-to-Image)
- 风格转换
- 草图上色
- 图像增强
- 可调变换强度

### 3. 局部重绘 (Inpainting)
- 智能遮罩编辑
- 物体移除
- 人脸修复
- 细节调整

### 4. 扩展绘制 (Outpainting)
- 智能画面扩展
- 上下文感知
- 无缝拼接
- 多方向扩展

### 5. ControlNet 控制
- 姿态控制
- 边缘检测
- 深度图控制
- 语义分割

### 6. Lora 支持
- Lora 模型应用
- 自定义风格
- 权重调节
- CLIP 强度

## 性能模式

| 模式 | 步数 | 速度 | 质量 | 适用场景 |
|------|------|------|------|----------|
| Fast | 20 | 1x | 70% | 实时预览 |
| Balance | 30 | 0.5x | 85% | 日常使用 |
| Quality | 50 | 0.25x | 95% | 最终输出 |

## 加速后端

| 后端 | 平台 | 性能 | 说明 |
|------|------|------|------|
| ONNX | Win/Mac/Linux | 中 | 通用加速 |
| TensorRT | Win/Linux | 高 | NVIDIA GPU |
| OpenVINO | Win/Linux | 中 | Intel 硬件 |
| CoreML | Mac/iOS | 高 | Apple 芯片 |

## 设备支持

| 设备 | 说明 | 推荐度 |
|------|------|--------|
| CUDA | NVIDIA GPU | ⭐⭐⭐⭐⭐ |
| MPS | Apple Silicon | ⭐⭐⭐⭐ |
| DirectML | Windows GPU | ⭐⭐⭐ |
| CPU | 通用处理器 | ⭐⭐ |

## 采样方法

| 方法 | 速度 | 质量 | 适用场景 |
|------|------|------|----------|
| Euler | 快 | 中 | 快速预览 |
| Euler-A | 快 | 中 | 多样性 |
| DPM++ 2M | 中 | 中 | 平衡 |
| DPM++ 2M Karras | 慢 | 高 | 高质量 |
| DDIM | 快 | 中 | 少量步数 |
| UniPC | 中 | 中 | 新方法 |

## 支持尺寸

| 尺寸 | 宽高比 | 推荐度 |
|------|--------|--------|
| 512×512 | 1:1 | ⭐⭐⭐⭐⭐ |
| 768×768 | 1:1 | ⭐⭐⭐ |
| 512×768 | 2:3 | ⭐⭐⭐ |
| 768×512 | 3:2 | ⭐⭐⭐ |
| 512×1024 | 1:2 | ⭐⭐⭐ |
| 1024×512 | 2:1 | ⭐⭐⭐ |

## 使用方法

### 1. 基本文生图
```typescript
const result = await agent.execute({
  type: 'text-to-image',
  params: {
    prompt: 'a beautiful sunset over the ocean',
    width: 512,
    height: 512,
    steps: 30,
    guidanceScale: 7.5,
    samplingMethod: 'euler',
  }
});
```

### 2. 图生图转换
```typescript
const result = await agent.execute({
  type: 'image-to-image',
  params: {
    prompt: 'transform to anime style',
    sourceImage: 'https://example.com/photo.jpg',
    strength: 0.7,  // 变换强度
    steps: 30,
  }
});
```

### 3. 局部重绘
```typescript
const result = await agent.execute({
  type: 'inpainting',
  params: {
    prompt: 'replace with a cat',
    sourceImage: 'https://example.com/photo.jpg',
    mask: 'base64-encoded-mask',
    steps: 30,
  }
});
```

### 4. ControlNet 姿态控制
```typescript
const result = await agent.execute({
  type: 'controlnet',
  params: {
    prompt: 'a person dancing',
    controlImage: 'pose-skeleton-image.jpg',
    controlType: 'pose',
    guidanceStart: 0,
    guidanceEnd: 1,
    weight: 1,
  }
});
```

### 5. Lora 风格应用
```typescript
const result = await agent.execute({
  type: 'lora',
  params: {
    prompt: 'portrait of a woman',
    loraPath: '/models/realistic_lora.safetensors',
    loraStrength: 1,
    weight: 1,
    clipStrength: 1,
  }
});
```

### 6. 批量生成
```typescript
const result = await agent.execute({
  type: 'batch',
  params: {
    prompts: [
      'a cat',
      'a dog',
      'a bird',
    ],
    settings: {
      width: 512,
      height: 512,
      steps: 25,
    },
    parallel: true,
  }
});
```

## ControlNet 类型

| 类型 | 用途 | 输入 |
|------|------|------|
| Canny | 边缘检测 | 边缘图像 |
| Depth | 深度图 | 深度图像 |
| Pose | 姿态骨架 | 姿态图像 |
| Normal | 法线图 | 法线图像 |
| Seg | 语义分割 | 分割图像 |
| Lineart | 线稿图 | 线稿图像 |
| Softedge | 软边缘 | 软边缘图像 |

## 提示词优化

### 基础结构
```
[主体], [细节], [场景], [光线], [风格], [质量标签]
```

### 示例
```
masterpiece, best quality, ultra detailed,
1girl, long hair, standing, flowers,
golden hour lighting, cinematic,
cyberpunk city background,
(8k, detailed:1.2)
```

### 负面提示词
```
blurry, low quality, deformed, ugly,
bad anatomy, extra fingers, mutated hands,
worst quality, low quality,
watermark, signature, text
```

## API 端点

| 功能 | 端点 | 方法 |
|------|------|------|
| 文生图 | /api/image/doubao-seedream-5-0-lite/txt2img | POST |
| 图生图 | /api/image/doubao-seedream-5-0-lite/img2img | POST |
| 局部重绘 | /api/image/doubao-seedream-5-0-lite/inpaint | POST |
| 扩展绘制 | /api/image/doubao-seedream-5-0-lite/outpaint | POST |
| ControlNet | /api/image/doubao-seedream-5-0-lite/controlnet | POST |
| Lora | /api/image/doubao-seedream-5-0-lite/lora | POST |

## 节点类型

| 节点 | 功能 | 说明 |
|------|------|------|
| doubaoSeedreamLiteInput | 图片输入 | 支持多种格式 |
| doubaoSeedreamLiteGen | 图片生成 | 文生图核心 |
| doubaoSeedreamLiteImg2Img | 图生图 | 风格转换 |
| doubaoSeedreamLiteInpaint | 局部重绘 | 智能编辑 |
| doubaoSeedreamLiteOutpaint | 扩展绘制 | 画面扩展 |
| doubaoSeedreamLiteControlNet | 控制网络 | 姿态/边缘 |
| doubaoSeedreamLiteLora | Lora | 风格应用 |

## 性能优化

### 速度优先
- 分辨率: 512×512
- 步数: 20-25
- 采样器: Euler
- Batch: 1

### 质量优先
- 分辨率: 768×768 或更高
- 步数: 40-50
- 采样器: DPM++ 2M Karras
- Batch: 1

### 显存优化
- 降低 batch_size
- 使用 512×512
- 关闭不需要的 ControlNet
- 考虑 CPU 模式

## 最佳实践

1. **快速预览**: Fast模式 + Euler + 512×512
2. **日常使用**: Balance模式 + DPM++ 2M + 512×512
3. **最终输出**: Quality模式 + DPM++ 2M Karras + 768×768
4. **批量生成**: 并行处理 + Fast模式
5. **本地部署**: TensorRT/CUDA 加速
