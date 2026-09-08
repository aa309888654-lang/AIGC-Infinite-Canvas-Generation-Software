const TEXT_EXECUTION_NODE_TYPES = new Set([
  'aiGenText',
  'textInput',
  'script',
  'storyboardMaker',
  'adCopyText',
  'brandCopyText',
  'storyboardEdit',
]);

function normalizeNodeType(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isTextExecutionNodeType(nodeType?: unknown, dataType?: unknown): boolean {
  const directType = normalizeNodeType(nodeType);
  const embeddedType = normalizeNodeType(dataType);
  return TEXT_EXECUTION_NODE_TYPES.has(directType) || TEXT_EXECUTION_NODE_TYPES.has(embeddedType);
}

