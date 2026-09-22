/**
 * MCP Server 统一入口
 * 提供统一的 MCP 工具调用接口
 */

import { videoMCPServer } from './video-mcp';
import { audioMCPServer } from './audio-mcp';
import { nodeMCPServer } from './node-mcp';

export async function executeMCPTool(
  server: 'video' | 'audio' | 'node',
  toolName: string,
  args: Record<string, unknown>
) {
  switch (server) {
    case 'video':
      return videoMCPServer.executeTool(toolName, args);
    case 'audio':
      return audioMCPServer.executeTool(toolName, args);
    case 'node':
      return nodeMCPServer.executeTool(toolName, args);
    default:
      return {
        success: false,
        error: `Unknown MCP server: ${server}`,
      };
  }
}

export { videoMCPServer } from './video-mcp';
export { audioMCPServer } from './audio-mcp';
export { nodeMCPServer } from './node-mcp';
