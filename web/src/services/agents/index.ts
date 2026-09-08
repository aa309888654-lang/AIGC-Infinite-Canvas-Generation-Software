export { BaseAgent } from './agent-framework';
export type { AgentConfig, AgentMessage, AgentResult, AgentExecutor } from './agent-framework';

export { agentManager, AgentManager } from './agent-manager';
export type { AgentType, AgentInfo } from './agent-manager';

export {
  CodeReviewAgent,
  BugFixAgent,
  FeatureAgent,
  TestAgent,
  DocAgent,
  RefactorAgent,
  ArchitectureAgent,
} from './development-agents';

export { mcpToolsRegistry, MCPToolsRegistry } from './mcp/mcp-tools-registry';
export type { MCPTool, ToolResult, ToolCategory, ToolExecutionContext } from './mcp/mcp-tools-registry';
