import type { Edge, Node } from '@xyflow/react';
import type { PortType, PortConfig } from '@/types/node-system';
import {
  validateNodeConnection as validateNodeConnectionFromNodeSystem,
} from '@/types/node-system';
import connectionRules from '@/config/connection-rules.json';
import { nodeRegistry } from './node-registry';

export interface ConnectionRule {
  valid: boolean;
  error?: string;
}

export interface NodeConnectionRule {
  denySources?: string[];
  maxInputs?: number;
  description?: string;
}

interface InferRule {
  pattern: string;
  type: PortType;
}

interface ConnectionRulesConfig {
  version: number;
  portCompatibility: Record<string, string[]>;
  /** @deprecated 已迁移至 node-system.ts 的 NODE_CONNECTION_RULES */
  nodeRules?: Record<string, NodeConnectionRule>;
  inferRules: InferRule[];
  defaultType: PortType;
  [key: string]: unknown;
}

let cachedConfig: ConnectionRulesConfig | null = null;

function getConfig(): ConnectionRulesConfig {
  if (!cachedConfig) {
    cachedConfig = connectionRules as unknown as ConnectionRulesConfig;
  }
  return cachedConfig;
}

export function getPortCompatibility(): Record<PortType, PortType[]> {
  const config = getConfig();
  return config.portCompatibility as Record<PortType, PortType[]>;
}

export function validatePortConnection(
  sourcePort: PortConfig,
  targetPort: PortConfig,
): ConnectionRule {
  const compat = getPortCompatibility();
  const sourceCompatible = compat[sourcePort.type] || [];
  const isCompatible =
    sourceCompatible.includes(targetPort.type) || sourcePort.type === targetPort.type;

  if (!isCompatible) {
    return {
      valid: false,
      error: `类型不兼容: ${sourcePort.type} 无法连接到 ${targetPort.type}`,
    };
  }

  return { valid: true };
}

export function validateNodeConnection(
  sourceNodeType: string,
  targetNodeType: string,
  targetNodeId?: string,
  edges?: Edge[],
): ConnectionRule {
  // ✅ P2-1：节点级规则单一数据源已迁移至 node-system.ts 的 NODE_CONNECTION_RULES
  return validateNodeConnectionFromNodeSystem(sourceNodeType, targetNodeType, targetNodeId, edges);
}

/**
 * 节点级规则验证（基于 Node 对象）
 * 在 validatePortTypes 之后调用，用于拦截特殊节点组合（如抠图→视频）和输入数量上限。
 *
 * @deprecated 请直接使用 node-system.ts 的 validateNodeConnection，避免多余的 Node 解包。
 */
export function validateNodeConnectionByNodes(
  sourceNode: Node,
  targetNode: Node,
  edges: Edge[] = [],
): ConnectionRule {
  const sourceNodeType = (sourceNode.data as { type?: string } | undefined)?.type || sourceNode.type || '';
  const targetNodeType = (targetNode.data as { type?: string } | undefined)?.type || targetNode.type || '';
  return validateNodeConnection(sourceNodeType, targetNodeType, targetNode.id, edges);
}

export function validatePortTypes(
  sourceNodeType: string,
  sourceHandleId: string,
  targetNodeType: string,
  targetHandleId: string,
): ConnectionRule {
  const sourcePortType = getPortType(sourceNodeType, sourceHandleId, 'source');
  const targetPortType = getPortType(targetNodeType, targetHandleId, 'target');

  if (!sourcePortType || !targetPortType) {
    return {
      valid: false,
      error: `无法解析端口类型: ${sourcePortType || sourceHandleId} → ${targetPortType || targetHandleId}`,
    };
  }

  const compat = getPortCompatibility();
  const sourceCompatible = compat[sourcePortType] || [];
  const isCompatible =
    sourceCompatible.includes(targetPortType) || sourcePortType === targetPortType;

  if (!isCompatible) {
    return {
      valid: false,
      error: `类型不兼容: ${sourcePortType}(${sourceNodeType}.${sourceHandleId}) 无法连接到 ${targetPortType}(${targetNodeType}.${targetHandleId})`,
    };
  }

  const nodeRule = validateNodeConnection(sourceNodeType, targetNodeType);
  if (!nodeRule.valid) return nodeRule;

  return { valid: true };
}

export function inferPortType(handleId: string): PortType {
  const config = getConfig();
  const id = handleId.toLowerCase();

  for (const rule of config.inferRules) {
    const patterns = rule.pattern.split('|');
    if (patterns.some((p) => id.includes(p.toLowerCase()))) {
      return rule.type;
    }
  }

  return config.defaultType as PortType;
}

function getPortType(
  nodeType: string,
  handleId: string,
  direction: 'source' | 'target',
): PortType | null {
  const manifest = nodeRegistry.get(nodeType);
  const ports = direction === 'source' ? manifest?.outputPorts : manifest?.inputPorts;
  const port = ports?.find((item) => item.id === handleId);

  if (port) return port.type;
  if (handleId) return inferPortType(handleId);
  return null;
}

export function isExecutableNodeType(nodeType: string): boolean {
  const manifest = nodeRegistry.get(nodeType);
  if (!manifest) return false;
  return manifest.execution?.executable === true;
}
