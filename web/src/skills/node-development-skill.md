# Node Development Skill

## 技能描述
React Flow 节点开发技能包，提供从节点设计到代码生成的完整开发流程。包括节点配置、组件开发、状态管理、API集成等专业能力。

## 能力清单

### 1. 节点设计
- **类型定义**: 定义节点类型和用途
- **端口配置**: 配置输入输出端口
- **参数面板**: 设计参数配置界面
- **样式定制**: 自定义节点外观

### 2. 组件开发
- **React Flow 集成**: 与 React Flow 集成
- **Handle 组件**: 连接点配置
- **参数控件**: 输入框、滑块、选择器
- **状态管理**: Zustand 状态管理

### 3. 节点模板
- **输入节点**: 文本、图像、视频、音频输入
- **生成节点**: 图像、视频、音频生成
- **处理节点**: 数据转换、过滤、合并
- **输出节点**: 结果输出、导出

### 4. API 集成
- **请求处理**: API 调用封装
- **错误处理**: 异常和错误处理
- **进度反馈**: 生成进度展示
- **结果缓存**: 缓存管理

### 5. 测试调试
- **单元测试**: Jest 单元测试
- **集成测试**: 完整流程测试
- **调试工具**: 开发调试辅助

## 使用方法

### 创建节点配置

```typescript
import type { FlowNodeType, NodeDevConfig, NodePortConfig, NodeParameterConfig } from '@/types/agent';

interface CreateNodeConfigParams {
  nodeType: FlowNodeType;
  label: string;
  category: string;
  inputs?: NodePortConfig[];
  outputs?: NodePortConfig[];
  parameters?: NodeParameterConfig[];
}

function createNodeConfig(params: CreateNodeConfigParams): NodeDevConfig {
  return {
    nodeType: params.nodeType,
    label: params.label,
    category: params.category,
    icon: getIconForType(params.nodeType),
    color: getColorForCategory(params.category),
    inputs: params.inputs || [],
    outputs: params.outputs || [],
    parameters: params.parameters || [],
    styles: {
      backgroundColor: '#1e1e2e',
      borderColor: '#6366f1',
      textColor: '#e2e8f0',
    },
  };
}

// 示例：创建视频生成节点
const videoGenConfig = createNodeConfig({
  nodeType: 'videoGen',
  label: '视频生成',
  category: 'generation',
  inputs: [
    { id: 'prompt', name: 'prompt', type: 'string', required: true },
    { id: 'reference', name: 'reference', type: 'image', required: false },
  ],
  outputs: [
    { id: 'result', name: 'result', type: 'video', required: true },
  ],
  parameters: [
    {
      id: 'duration',
      name: 'duration',
      type: 'slider',
      label: '时长',
      defaultValue: 5,
      min: 1,
      max: 30,
      step: 1,
    },
    {
      id: 'resolution',
      name: 'resolution',
      type: 'select',
      label: '分辨率',
      defaultValue: '1080p',
      options: [
        { label: '720p', value: '720p' },
        { label: '1080p', value: '1080p' },
        { label: '4K', value: '4k' },
      ],
    },
  ],
});
```

### 生成节点组件代码

```typescript
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useNodeStore } from '@/store/nodeStore';

interface VideoGenNodeData {
  params: {
    duration: number;
    resolution: string;
    prompt?: string;
  };
  task?: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
  };
}

function VideoGenNode({ id, data, selected }: NodeProps<VideoGenNodeData>) {
  const { params, task } = data;
  const updateNodeData = useNodeStore((state) => state.updateNodeData);

  const handleParamChange = (key: string, value: unknown) => {
    updateNodeData(id, {
      params: { ...params, [key]: value },
    });
  };

  return (
    <div
      style={{
        background: '#1e1e2e',
        border: `2px solid ${selected ? '#818cf8' : '#6366f1'}`,
        borderRadius: 8,
        padding: 12,
        minWidth: 220,
      }}
    >
      {/* 标题 */}
      <div style={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: 12 }}>
        视频生成
      </div>

      {/* 输入 Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="prompt"
        style={{ background: '#6366f1', top: '30%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="reference"
        style={{ background: '#8b5cf6', top: '50%' }}
      />

      {/* 参数控件 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>时长 (秒)</span>
          <input
            type="range"
            min={1}
            max={30}
            value={params.duration}
            onChange={(e) => handleParamChange('duration', Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <span style={{ color: '#e2e8f0' }}>{params.duration}s</span>
        </label>

        <label>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>分辨率</span>
          <select
            value={params.resolution}
            onChange={(e) => handleParamChange('resolution', e.target.value)}
            style={{
              width: '100%',
              background: '#0f0f1a',
              color: '#e2e8f0',
              border: '1px solid #6366f1',
              borderRadius: 4,
              padding: 4,
            }}
          >
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
            <option value="4k">4K</option>
          </select>
        </label>
      </div>

      {/* 输出 Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="result"
        style={{ background: '#ec4899' }}
      />
    </div>
  );
}

export default memo(VideoGenNode);
```

### 状态管理 (Zustand)

```typescript
import { create } from 'zustand';

interface NodeState {
  nodes: Record<string, NodeData>;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  setNodeTask: (nodeId: string, task: TaskData) => void;
  clearNode: (nodeId: string) => void;
}

interface NodeData {
  params: Record<string, unknown>;
  task?: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    result?: unknown;
    error?: string;
  };
}

export const useNodeStore = create<NodeState>((set) => ({
  nodes: {},

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: {
          ...state.nodes[nodeId],
          ...data,
        },
      },
    })),

  setNodeTask: (nodeId, task) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: {
          ...state.nodes[nodeId],
          task,
        },
      },
    })),

  clearNode: (nodeId) =>
    set((state) => {
      const { [nodeId]: _, ...rest } = state.nodes;
      return { nodes: rest };
    }),
}));
```

## 示例

### 示例 1: 创建完整的图像生成节点

```typescript
// 1. 节点配置
const imageGenConfig = createNodeConfig({
  nodeType: 'imageGen',
  label: '图像生成',
  category: 'generation',
  inputs: [
    { id: 'prompt', name: 'prompt', type: 'string', required: true },
  ],
  outputs: [
    { id: 'result', name: 'result', type: 'image', required: true },
  ],
  parameters: [
    {
      id: 'aspectRatio',
      name: 'aspectRatio',
      type: 'select',
      label: '宽高比',
      defaultValue: '1:1',
      options: [
        { label: '1:1', value: '1:1' },
        { label: '16:9', value: '16:9' },
        { label: '9:16', value: '9:16' },
      ],
    },
    {
      id: 'style',
      name: 'style',
      type: 'select',
      label: '风格',
      defaultValue: 'realistic',
      options: [
        { label: '写实', value: 'realistic' },
        { label: '动漫', value: 'anime' },
        { label: '艺术', value: 'artistic' },
      ],
    },
    {
      id: 'quality',
      name: 'quality',
      type: 'slider',
      label: '质量',
      defaultValue: 80,
      min: 10,
      max: 100,
      step: 10,
    },
  ],
});

// 2. 注册节点类型
registerNodeType('imageGen', ImageGenNode, imageGenConfig);

// 3. 在工作流中使用
addNodeToWorkflow({
  type: 'imageGen',
  position: { x: 100, y: 200 },
  data: {
    params: {
      aspectRatio: '1:1',
      style: 'anime',
      quality: 80,
    },
  },
});
```

### 示例 2: 节点连接验证

```typescript
function validateConnection(
  sourceNode: Node,
  targetNode: Node,
  sourceHandle: string,
  targetHandle: string
): ConnectionValidation {
  const sourceOutput = sourceNode.data.config.outputs.find(
    (o) => o.id === sourceHandle
  );
  const targetInput = targetNode.data.config.inputs.find(
    (i) => i.id === targetHandle
  );

  if (!sourceOutput || !targetInput) {
    return { valid: false, reason: 'Handle not found' };
  }

  const compatible = isTypeCompatible(sourceOutput.type, targetInput.type);

  return {
    valid: compatible,
    reason: compatible ? 'Types match' : 'Type mismatch',
  };
}

function isTypeCompatible(source: string, target: string): boolean {
  const compatibilityMap: Record<string, string[]> = {
    image: ['image', 'any'],
    video: ['video', 'any'],
    audio: ['audio', 'any'],
    string: ['string', 'any'],
    any: ['image', 'video', 'audio', 'string', 'any'],
  };

  const allowed = compatibilityMap[source] || [];
  return allowed.includes(target);
}
```

## 最佳实践

1. **性能优化**
   - 使用 `React.memo` 包装节点
   - 避免不必要的重渲染
   - 合理使用 useCallback

2. **类型安全**
   - 完整的 TypeScript 类型
   - 严格的类型检查
   - 类型守卫函数

3. **错误处理**
   - 节点级别错误边界
   - API 错误捕获
   - 用户友好的错误提示

4. **可访问性**
   - 键盘导航支持
   - ARIA 标签
   - 颜色对比度

## 注意事项

- 节点 ID 唯一性
- 连接点位置规划
- 参数验证和默认值
- 状态持久化
