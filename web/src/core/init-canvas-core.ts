/**
 * v3 画布核心初始化 — 在应用启动时调用一次
 */
import { pluginLoader } from './plugin-loader';
import { mcpClientHub } from './mcp-client-hub';
import { nodeRegistry } from './node-registry';

let bootstrapped = false;

export function initCanvasCore(): void {
  if (bootstrapped) return;
  nodeRegistry.init();
  pluginLoader.loadBuiltInManifests();
  void mcpClientHub.init();
  bootstrapped = true;
}

export { nodeRegistry, pluginLoader, mcpClientHub };
export { canvasExecutionEngine } from './canvas-execution-engine';
export { getActiveRegistryDefinitions, resolveNodeDefinition } from './node-registry';
export { PORT_COMPATIBILITY } from '@/types/node-system';
export { isExecutableNodeType } from './connection-rules';
export { canvasAgentRegistry } from './canvas-agent-registry';
export { agentAdapter } from './agent-adapter';
export { StateGraphEngine, stateGraphEngine, registerCondition } from './state-graph-engine';
export { runReviewLoop, createStateGraphWithReview, runStateGraphWithReview } from './review-loop-example';
