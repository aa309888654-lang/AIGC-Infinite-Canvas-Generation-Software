/**
 * 画布节点注册表一致性校验 — 供 Jest / E2E 使用
 */
import { flowNodeTypes } from '@/components/canvas/flow-node-types';
import { AICG_SLASH_COMMANDS } from '@/services/aicg-slash-commands';
import { AICG_WORKFLOW_TEMPLATES } from '@/services/aicg-workflow-service';
import {
  getDefaultTargetHandle,
  NODE_HANDLE_ADJACENCY,
  type HandleQuickAddOption,
} from '@/services/node-handle-adjacency';
import {
  buildNodeDataFromDefinition,
  getPortType,
  NODE_TYPES,
  validatePortTypes,
  type NodeTypeDefinition,
} from '@/types/node-system';

export interface RegistryIssue {
  severity: 'error' | 'warn';
  code: string;
  message: string;
}

/** flowNodeTypes 中允许存在、但不在 NODE_TYPES 里的兼容别名 */
export const FLOW_NODE_ALIASES = new Set([
  'textInput',
  'photoGrid',
  'magicStoryboard',
  'imageGridSplitter',
  'imageGen',
  'videoGen',
  'imageAnalysis',
  'inpainting',
  'outpainting',
]);

export function getActiveNodeDefinitions(): NodeTypeDefinition[] {
  return NODE_TYPES.filter((def) => !def.deprecated);
}

export function getAllFlowNodeTypeKeys(): string[] {
  return Object.keys(flowNodeTypes);
}

function getDef(nodeType: string): NodeTypeDefinition | undefined {
  return NODE_TYPES.find((n) => n.id === nodeType);
}

function validateQuickAddConnection(
  sourceNodeType: string,
  sourceHandle: string,
  option: HandleQuickAddOption
): RegistryIssue[] {
  const issues: RegistryIssue[] = [];
  const targetType = option.nodeType;
  const targetHandle = option.targetHandle ?? getDefaultTargetHandle(targetType, sourceNodeType);

  if (!getDef(targetType) && !FLOW_NODE_ALIASES.has(targetType)) {
    issues.push({
      severity: 'error',
      code: 'adjacency-unknown-target',
      message: `${sourceNodeType}.${sourceHandle} → 未知节点类型 ${targetType}`,
    });
    return issues;
  }

  const resolvedTarget = getDef(targetType)?.id ?? targetType;
  const result = validatePortTypes(sourceNodeType, sourceHandle, resolvedTarget, targetHandle);
  if (!result.valid) {
    issues.push({
      severity: 'error',
      code: 'adjacency-port-incompatible',
      message: `${sourceNodeType}.${sourceHandle} → ${targetType}.${targetHandle}: ${result.error}`,
    });
  }
  return issues;
}

function hasPort(
  def: NodeTypeDefinition | undefined,
  handleId: string,
  direction: 'source' | 'target'
): boolean {
  const ports = direction === 'source' ? def?.outputPorts : def?.inputPorts;
  return !!ports?.some((port) => port.id === handleId);
}

export function validateNodeRegistry(): RegistryIssue[] {
  const issues: RegistryIssue[] = [];
  const flowKeys = new Set(getAllFlowNodeTypeKeys());
  const nodeIds = new Set(NODE_TYPES.map((n) => n.id));

  // 1. 每个非 deprecated 节点必须有 React Flow 组件
  for (const def of getActiveNodeDefinitions()) {
    if (!flowKeys.has(def.id)) {
      issues.push({
        severity: 'error',
        code: 'missing-flow-component',
        message: `节点 ${def.id} (${def.name}) 未在 flowNodeTypes 注册`,
      });
    }
  }

  // 2. flowNodeTypes 中的 key 必须对应 NODE_TYPES 或已知别名
  for (const key of flowKeys) {
    if (!nodeIds.has(key) && !FLOW_NODE_ALIASES.has(key)) {
      issues.push({
        severity: 'error',
        code: 'orphan-flow-key',
        message: `flowNodeTypes.${key} 在 NODE_TYPES 中不存在且非已知别名`,
      });
    }
  }

  // 3. 每个节点定义应能构建默认 data
  for (const def of NODE_TYPES) {
    try {
      const data = buildNodeDataFromDefinition(def);
      if (!data.type || data.type !== def.id) {
        issues.push({
          severity: 'error',
          code: 'invalid-node-data',
          message: `buildNodeDataFromDefinition(${def.id}) 返回 type=${String(data.type)}`,
        });
      }
    } catch (err) {
      issues.push({
        severity: 'error',
        code: 'node-data-throw',
        message: `buildNodeDataFromDefinition(${def.id}) 抛出: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // 4. 句柄邻接表连接合法性
  for (const [sourceType, handles] of Object.entries(NODE_HANDLE_ADJACENCY)) {
    const sourceDef = getDef(sourceType);
    if (!flowKeys.has(sourceType) && !nodeIds.has(sourceType)) {
      issues.push({
        severity: 'warn',
        code: 'adjacency-unknown-source',
        message: `NODE_HANDLE_ADJACENCY 源节点 ${sourceType} 未注册`,
      });
    }
    for (const [handleId, options] of Object.entries(handles)) {
      if (options.length > 0 && !hasPort(sourceDef, handleId, 'source')) {
        issues.push({
          severity: 'error',
          code: 'adjacency-missing-source-port',
          message: `${sourceType}.${handleId} 不在节点输出端口声明中`,
        });
      }
      for (const opt of options) {
        issues.push(...validateQuickAddConnection(sourceType, handleId, opt));
      }
    }
  }

  // 5. Slash 指令节点类型
  for (const cmd of AICG_SLASH_COMMANDS) {
    if (!getDef(cmd.nodeType) && !FLOW_NODE_ALIASES.has(cmd.nodeType)) {
      issues.push({
        severity: 'error',
        code: 'slash-unknown-node',
        message: `Slash ${cmd.slash} 指向未知节点 ${cmd.nodeType}`,
      });
    }
  }

  // 6. AICG 工作流模板
  for (const tpl of AICG_WORKFLOW_TEMPLATES) {
    for (const step of tpl.steps) {
      if (!getDef(step.nodeType)) {
        issues.push({
          severity: 'error',
          code: 'workflow-unknown-node',
          message: `模板 ${tpl.id} 使用未知节点 ${step.nodeType}`,
        });
      }
    }
    for (const [si, ti, sh, th] of tpl.links) {
      const fromStep = tpl.steps[si];
      const toStep = tpl.steps[ti];
      if (!fromStep || !toStep || !sh || !th) continue;
      const result = validatePortTypes(fromStep.nodeType, sh, toStep.nodeType, th);
      if (!result.valid) {
        issues.push({
          severity: 'error',
          code: 'workflow-port-incompatible',
          message: `模板 ${tpl.id}: ${fromStep.nodeType}.${sh} → ${toStep.nodeType}.${th}: ${result.error}`,
        });
      }
    }
  }

  // 7. deprecated 节点若仍保留 flow 映射，应指向 replacedBy
  for (const def of NODE_TYPES.filter((n) => n.deprecated && n.replacedBy)) {
    if (flowKeys.has(def.id) && !flowKeys.has(def.replacedBy!)) {
      issues.push({
        severity: 'warn',
        code: 'deprecated-without-replacement',
        message: `已弃用节点 ${def.id} 的替代 ${def.replacedBy} 未注册 flow 组件`,
      });
    }
  }

  // 8. 所有声明端口必须可被类型系统解析
  for (const def of NODE_TYPES) {
    for (const port of def.inputPorts) {
      if (getPortType(def.id, port.id, 'target') !== port.type) {
        issues.push({
          severity: 'error',
          code: 'port-type-unresolved',
          message: `${def.id}.${port.id}:target 无法解析为 ${port.type}`,
        });
      }
    }
    for (const port of def.outputPorts) {
      if (getPortType(def.id, port.id, 'source') !== port.type) {
        issues.push({
          severity: 'error',
          code: 'port-type-unresolved',
          message: `${def.id}.${port.id}:source 无法解析为 ${port.type}`,
        });
      }
    }
  }

  return issues;
}

export function getRegistrySummary() {
  const issues = validateNodeRegistry();
  return {
    nodeTypeCount: NODE_TYPES.length,
    activeNodeCount: getActiveNodeDefinitions().length,
    flowNodeTypeCount: getAllFlowNodeTypeKeys().length,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warnCount: issues.filter((i) => i.severity === 'warn').length,
    issues,
  };
}

/** 常见流水线连接冒烟用例 */
export const CONNECTION_SMOKE_CASES: Array<{
  name: string;
  sourceType: string;
  sourceHandle: string;
  targetType: string;
  targetHandle: string;
}> = [
  {
    name: '图片输入→AICG生图',
    sourceType: 'imageInput',
    sourceHandle: 'imageOutput',
    targetType: 'aiImage',
    targetHandle: 'input',
  },
  {
    name: 'AICG生图→AI视频',
    sourceType: 'aicgImageGen',
    sourceHandle: 'output',
    targetType: 'aiVideo',
    targetHandle: 'input',
  },
  {
    name: '提示词→生成文本',
    sourceType: 'prompt',
    sourceHandle: 'promptOutput',
    targetType: 'aiGenText',
    targetHandle: 'promptInput',
  },
  {
    name: 'AI生图→经典视频',
    sourceType: 'aiImage',
    sourceHandle: 'output',
    targetType: 'aiVideo',
    targetHandle: 'input',
  },
  {
    name: '视频→导出',
    sourceType: 'aiVideo',
    sourceHandle: 'output',
    targetType: 'output',
    targetHandle: 'video',
  },
  {
    name: '视频→抽帧',
    sourceType: 'aiVideo',
    sourceHandle: 'output',
    targetType: 'frameExtractor',
    targetHandle: 'input',
  },
  {
    name: '抽帧→图片',
    sourceType: 'frameExtractor',
    sourceHandle: 'output',
    targetType: 'aiImage',
    targetHandle: 'input',
  },
  {
    name: '音频→导出',
    sourceType: 'audioGen',
    sourceHandle: 'audioOutput',
    targetType: 'output',
    targetHandle: 'audio',
  },
  {
    name: '音频输入→导出',
    sourceType: 'audioInput',
    sourceHandle: 'audioOutput',
    targetType: 'output',
    targetHandle: 'audio',
  },
  {
    name: '抠图→生图',
    sourceType: 'localMatting',
    sourceHandle: 'output',
    targetType: 'aiImage',
    targetHandle: 'input',
  },
  {
    name: '剧本→分镜',
    sourceType: 'script',
    sourceHandle: 'scenes',
    targetType: 'gridDirector',
    targetHandle: 'scriptInput',
  },
  {
    name: '角色库→角色一致性',
    sourceType: 'characterLibrary',
    sourceHandle: 'characterRef',
    targetType: 'characterConsistency',
    targetHandle: 'characterImage',
  },
  {
    name: '角色库 payload→分镜',
    sourceType: 'characterLibrary',
    sourceHandle: 'payload',
    targetType: 'gridDirector',
    targetHandle: 'scriptInput',
  },
];

export function validateConnectionSmokeCases(): RegistryIssue[] {
  const issues: RegistryIssue[] = [];
  for (const c of CONNECTION_SMOKE_CASES) {
    const result = validatePortTypes(c.sourceType, c.sourceHandle, c.targetType, c.targetHandle);
    if (!result.valid) {
      issues.push({
        severity: 'error',
        code: 'smoke-connection-fail',
        message: `${c.name}: ${result.error}`,
      });
    }
  }
  return issues;
}
