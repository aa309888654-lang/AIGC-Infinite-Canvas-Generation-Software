import { StateGraphEngine, registerCondition } from './state-graph-engine';
import { agentAdapter, type AgentRunResult } from './agent-adapter';
import type { StateGraphContext } from './state-graph-engine';

export interface ReviewLoopConfig {
  imageGenNodeId: string;
  reviewerNodeId: string;
  maxRetries: number;
  qualityThreshold: number;
}

export interface ReviewLoopResult {
  passed: boolean;
  attempts: number;
  finalScore?: number;
  finalVerdict?: 'pass' | 'fail';
  retryPrompts: string[];
}

registerCondition('reviewer_pass', (output) => {
  return output.verdict === 'pass' ? 'pass' : null;
});

registerCondition('reviewer_fail', (output) => {
  return output.verdict === 'fail' ? 'fail' : null;
});

registerCondition('score_above_threshold', (output) => {
  return typeof output.score === 'number' && output.score >= 70 ? 'pass' : null;
});

export async function runReviewLoop(
  prompt: string,
  config: ReviewLoopConfig,
  onStep?: (phase: string, detail: string) => void,
): Promise<ReviewLoopResult> {
  const result: ReviewLoopResult = {
    passed: false,
    attempts: 0,
    retryPrompts: [],
  };

  let currentPrompt = prompt;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    result.attempts = attempt;
    onStep?.('generate', `第 ${attempt} 次生成，提示词: ${currentPrompt.slice(0, 50)}...`);

    const designerResult: AgentRunResult = await agentAdapter.runAgent('designer', currentPrompt);
    if (!designerResult.success) {
      onStep?.('error', `设计师 Agent 失败: ${designerResult.error}`);
      continue;
    }

    const generatedPrompt = designerResult.parsedOutput?.prompt as string | undefined;
    if (!generatedPrompt) {
      onStep?.('error', '设计师 Agent 未返回有效提示词');
      continue;
    }

    onStep?.('review', `审查第 ${attempt} 次生成结果...`);

    const reviewerResult: AgentRunResult = await agentAdapter.runAgent(
      'reviewer',
      `请审查以下生成结果。原始需求: ${currentPrompt}\n生成提示词: ${generatedPrompt}`,
    );

    result.finalScore = reviewerResult.score;
    result.finalVerdict = reviewerResult.verdict;

    if (reviewerResult.verdict === 'pass') {
      result.passed = true;
      onStep?.('pass', `审查通过！得分: ${reviewerResult.score}`);
      break;
    }

    if (reviewerResult.retryPrompt) {
      result.retryPrompts.push(reviewerResult.retryPrompt);
      currentPrompt = reviewerResult.retryPrompt;
    }

    if (reviewerResult.issues?.length) {
      onStep?.('fail', `审查不通过: ${reviewerResult.issues.join('; ')}`);
    }

    if (attempt >= config.maxRetries) {
      onStep?.('max_retries', `已达最大重试次数 ${config.maxRetries}`);
    }
  }

  return result;
}

export function createStateGraphWithReview(
  imageGenNodeId: string,
  reviewerNodeId: string,
  retryTargetNodeId: string,
): StateGraphEngine {
  const engine = new StateGraphEngine();

  engine.addEdge({
    from: imageGenNodeId,
    to: reviewerNodeId,
    label: '生成完成',
  });

  engine.addEdge({
    from: reviewerNodeId,
    to: retryTargetNodeId,
    condition: 'reviewer_fail',
    label: '审查不通过→重试',
  });

  return engine;
}

export async function runStateGraphWithReview(
  nodes: import('@xyflow/react').Node[],
  edges: import('@xyflow/react').Edge[],
  imageGenNodeId: string,
  reviewerNodeId: string,
  executeNode: (nodeId: string, ctx: StateGraphContext) => Promise<Record<string, unknown>>,
  onNodeStatus?: (nodeId: string, status: import('./state-graph-engine').GraphNodeStatus) => void,
): Promise<import('./state-graph-engine').StateGraphRunResult> {
  const engine = createStateGraphWithReview(
    imageGenNodeId,
    reviewerNodeId,
    imageGenNodeId,
  );

  engine.loadFromCanvas(nodes, edges);

  return engine.run({
    maxLoopPerNode: 2,
    executeNode,
    onNodeStatus,
    onEdgeTraversed: (from, to, label) => {
      console.log(`[StateGraph] 边遍历: ${from} → ${to}${label ? ` (${label})` : ''}`);
    },
  });
}
