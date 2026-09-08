/**
 * v3 执行引擎层 — MCP Client Hub
 * 统一封装应用内 MCP Server + dev-tools registry
 */
import { executeMCPTool } from '@/mcp';
import { mcpToolsRegistry, type MCPTool, type ToolResult } from '@/services/agents/mcp/mcp-tools-registry';

export interface MCPToolDescriptor {
  id: string;
  name: string;
  description: string;
  server: string;
  category?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPCallResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

type BuiltinServer = 'video' | 'audio' | 'node';

const BUILTIN_SERVERS: { id: BuiltinServer; label: string }[] = [
  { id: 'video', label: '视频 MCP' },
  { id: 'audio', label: '音频 MCP' },
  { id: 'node', label: '画布节点 MCP' },
];

class MCPClientHub {
  private initialized = false;
  private extraTools = new Map<string, MCPToolDescriptor>();

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  getServers(): { id: string; label: string }[] {
    return [
      ...BUILTIN_SERVERS,
      { id: 'dev-tools', label: '开发工具 MCP' },
    ];
  }

  /** 列出所有可用工具 */
  listTools(): MCPToolDescriptor[] {
    const builtin: MCPToolDescriptor[] = [
      { id: 'video:process', name: 'process', description: '视频处理', server: 'video' },
      { id: 'audio:process', name: 'process', description: '音频处理', server: 'audio' },
      { id: 'node:create', name: 'create_node', description: '创建画布节点', server: 'node' },
      { id: 'node:connect', name: 'connect_nodes', description: '连接节点', server: 'node' },
    ];

    const devTools: MCPToolDescriptor[] = mcpToolsRegistry.getAllTools().map((tool: MCPTool) => ({
      id: `dev-tools:${tool.definition.function.name}`,
      name: tool.definition.function.name,
      description: tool.description || tool.definition.function.description || '',
      server: 'dev-tools',
      category: tool.category,
      inputSchema: tool.definition.function.parameters as Record<string, unknown>,
    }));

    return [...builtin, ...devTools, ...this.extraTools.values()];
  }

  /** 调用工具 — toolId 格式 server:toolName 或 dev-tools:name */
  async callTool(toolId: string, args: Record<string, unknown> = {}): Promise<MCPCallResult> {
    const [server, ...rest] = toolId.split(':');
    const toolName = rest.join(':');

    if (server === 'dev-tools') {
      try {
        const result: ToolResult = await mcpToolsRegistry.execute(toolName, args);
        return { success: result.success, result: result.result, error: result.error };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (server === 'video' || server === 'audio' || server === 'node') {
      try {
        const raw = await executeMCPTool(server, toolName, args);
        if (raw && typeof raw === 'object' && 'success' in raw) {
          const r = raw as { success: boolean; result?: unknown; error?: string };
          return { success: r.success, result: r.result, error: r.error };
        }
        return { success: true, result: raw };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    return { success: false, error: `未知 MCP Server: ${server}` };
  }

  registerTool(descriptor: MCPToolDescriptor): void {
    this.extraTools.set(descriptor.id, descriptor);
  }
}

export const mcpClientHub = new MCPClientHub();
