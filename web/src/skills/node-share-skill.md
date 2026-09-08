# 节点分享技能

## 技能描述
专业的节点分享和社区交流技能，支持节点的导入导出、社区分享、模板管理、节点搜索和版本控制。

## 能力清单

### 1. 节点导出 (Export)
- **JSON格式**: 导出为标准JSON格式
- **Base64格式**: 导出为Base64编码，便于复制粘贴
- **文件导出**: 导出为本地文件
- **元数据**: 可选包含作者、版本等信息

### 2. 节点导入 (Import)
- **剪贴板**: 从剪贴板粘贴导入
- **文件**: 从本地文件导入
- **URL**: 从网络链接导入（GitHub、Gist等）
- **验证**: 自动验证节点格式
- **合并策略**: 支持替换、合并、跳过

### 3. 社区分享 (Share)
- **发布节点**: 分享到社区供他人使用
- **发布模板**: 分享完整工作流模板
- **权限控制**: 公开/私有/未列出
- **许可协议**: 选择合适的开源许可证

### 4. 社区浏览 (Browse)
- **分类浏览**: 按类别查看节点
- **排序选项**: 热门/最新/评分/下载量
- **分页查看**: 支持分页加载
- **节点预览**: 查看节点详情和代码

### 5. 节点搜索 (Search)
- **关键词搜索**: 按名称、描述搜索
- **分类筛选**: 按类别筛选
- **标签筛选**: 按标签筛选
- **评分筛选**: 最低评分筛选
- **排序方式**: 相关性/评分/下载量

### 6. 模板管理 (Template)
- **创建模板**: 从当前工作流创建模板
- **Fork模板**: 基于现有模板创建副本
- **模板修改**: 自定义模板参数
- **模板分类**: 按用途分类管理

### 7. 评分反馈 (Rating)
- **星级评分**: 1-5星评价
- **文字评论**: 留下详细评价
- **反馈问题**: 报告节点问题

### 8. 版本控制 (Version)
- **版本历史**: 查看更新历史
- **版本对比**: 对比不同版本差异
- **版本切换**: 使用历史版本

## 节点分类

| 分类 | 图标 | 描述 |
|------|------|------|
| 视频生成 | 🎬 | AI视频生成节点 |
| 图片生成 | 🖼️ | AI图片生成节点 |
| 音频处理 | 🎵 | 音频合成和处理节点 |
| 视频剪辑 | ✂️ | 视频编辑和剪辑节点 |
| 特效处理 | ✨ | 视觉特效节点 |
| 模板流程 | 📋 | 完整工作流模板 |
| 工具节点 | 🔧 | 辅助工具节点 |
| 实验性 | 🔬 | 实验性功能节点 |

## 许可证类型

| 许可证 | 说明 |
|--------|------|
| MIT | 允许自由使用和修改 |
| Apache 2.0 | 允许商业使用 |
| GPL 3.0 | 要求开源衍生作品 |
| CC BY 4.0 | 需署名使用 |
| CC BY-SA 4.0 | 需署名且相同方式分享 |
| 专有许可 | 不可自由使用 |

## 使用方法

### 1. 导出节点
```typescript
const result = await agent.execute({
  type: 'export',
  params: {
    nodeId: 'video-gen-node-1',
    format: 'json',
    includeMetadata: true,
  }
});

// 返回:
// {
//   success: true,
//   data: '{"type":"videoGen","params":{...}}',
//   format: 'json',
//   nodeId: 'video-gen-node-1',
//   nodeName: '视频生成节点',
//   metadata: {
//     exportedAt: '2024-01-01T00:00:00Z',
//     version: '1.0.0',
//     author: '用户名'
//   }
// }
```

### 2. 导入节点
```typescript
const result = await agent.execute({
  type: 'import',
  params: {
    data: '{"type":"videoGen","params":{...}}',
    source: 'clipboard',
    validate: true,
    mergeStrategy: 'merge',
  }
});
```

### 3. 分享到社区
```typescript
const result = await agent.execute({
  type: 'share',
  params: {
    nodeId: 'my-video-node',
    name: '我的视频生成节点',
    description: '这是一个非常好用的视频生成节点',
    category: 'video-generation',
    tags: ['视频', 'AI', 'Seedance'],
    visibility: 'public',
    license: 'mit',
  }
});

// 返回:
// {
//   success: true,
//   shareId: 'abc123',
//   shareUrl: '/nodes/share/abc123',
//   nodeName: '我的视频生成节点'
// }
```

### 4. 浏览社区
```typescript
const result = await agent.execute({
  type: 'browse',
  params: {
    category: 'video-generation',
    sortBy: 'popular',
    page: 1,
    pageSize: 20,
  }
});
```

### 5. 搜索节点
```typescript
const result = await agent.execute({
  type: 'search',
  params: {
    query: '视频生成 Seedance',
    categories: ['video-generation'],
    tags: ['AI'],
    minRating: 4,
    sortBy: 'rating',
  }
});
```

### 6. 评分节点
```typescript
const result = await agent.execute({
  type: 'rate',
  params: {
    nodeId: 'popular-video-node',
    rating: 5,
    comment: '非常好用的节点！',
  }
});
```

### 7. Fork模板
```typescript
const result = await agent.execute({
  type: 'fork',
  params: {
    templateId: 'manga-workflow-1',
    newName: '我的漫剧工作流',
    modifications: [
      { nodeId: 'node-1', changes: { duration: 10 } },
    ],
  }
});
```

### 8. 创建模板
```typescript
const result = await agent.execute({
  type: 'create-template',
  params: {
    name: '快速视频生成模板',
    description: '适用于快速生成短视频的模板',
    nodes: [...],
    edges: [...],
    category: 'video-generation',
    tags: ['模板', '视频'],
  }
});
```

## API 端点

| 功能 | 端点 | 方法 |
|------|------|------|
| 获取节点 | /api/nodes/:id | GET |
| 分享节点 | /api/nodes/share | POST |
| 浏览社区 | /api/nodes/community | GET |
| 搜索节点 | /api/nodes/search | GET |
| 评分节点 | /api/nodes/:id/rate | POST |
| 创建模板 | /api/templates | POST |
| Fork模板 | /api/templates/:id/fork | POST |
| 版本历史 | /api/nodes/:id/versions | GET |

## 最佳实践

### 分享节点
1. **填写完整信息**: 名称、描述、标签、截图
2. **选择合适分类**: 便于他人发现
3. **选择许可证**: 明确使用条款
4. **测试后分享**: 确保节点可用

### 使用模板
1. **预览再Fork**: 查看模板结构
2. **修改参数**: 根据需求调整
3. **测试运行**: 确保流程正确
4. **保存副本**: Fork后保存自己的版本

### 社区规范
1. **尊重原创**: 引用需注明来源
2. **真实评价**: 客观评分和评论
3. **反馈问题**: 有问题及时报告
4. **积极贡献**: 分享优质节点

## 常见问题

### Q: 导入失败怎么办？
A: 检查JSON格式是否正确，尝试Base64解码导入

### Q: 如何更新已分享的节点？
A: 使用相同ID重新分享，系统会更新版本

### Q: 模板可以私有吗？
A: 是的，可以选择私有分享

### Q: 如何删除已分享的节点？
A: 联系管理员或在个人中心管理
