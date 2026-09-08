import type { Node } from '@xyflow/react';

export type WorkflowMediaResolver = (relativePath: string) => Promise<string>;

export function isWorkflowMediaReference(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('./media/');
}

export async function restoreWorkflowMediaReferences(value: unknown, resolveMediaPath: WorkflowMediaResolver): Promise<unknown> {
  if (isWorkflowMediaReference(value)) {
    return resolveMediaPath(value);
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map(item => restoreWorkflowMediaReferences(item, resolveMediaPath)));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] = await restoreWorkflowMediaReferences(childValue, resolveMediaPath);
    }
    return result;
  }

  return value;
}

export async function restoreWorkflowMediaReferencesInNodes(
  nodes: Node[],
  resolveMediaPath: WorkflowMediaResolver
): Promise<Node[]> {
  return Promise.all(
    nodes.map(async node => ({
      ...node,
      data: await restoreWorkflowMediaReferences(node.data, resolveMediaPath) as Record<string, unknown>,
    }))
  );
}
