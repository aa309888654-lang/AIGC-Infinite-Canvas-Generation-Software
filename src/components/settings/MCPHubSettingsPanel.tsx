import React, { useState, useEffect, useCallback } from 'react';
import { mcpClientHub, type MCPToolDescriptor } from '@/core/mcp-client-hub';
import { Server, Wrench, ChevronRight, ChevronDown, Circle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServerGroup {
  id: string;
  label: string;
  tools: MCPToolDescriptor[];
  expanded: boolean;
}

const MCPHubSettingsPanel: React.FC = () => {
  const [groups, setGroups] = useState<ServerGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTools = useCallback(async () => {
    setLoading(true);
    try {
      await mcpClientHub.init();
      const tools = mcpClientHub.listTools();
      const serverMap = new Map<string, MCPToolDescriptor[]>();

      for (const tool of tools) {
        const existing = serverMap.get(tool.server) || [];
        existing.push(tool);
        serverMap.set(tool.server, existing);
      }

      const servers = mcpClientHub.getServers();
      const newGroups: ServerGroup[] = servers.map((s) => ({
        id: s.id,
        label: s.label,
        tools: serverMap.get(s.id) || [],
        expanded: false,
      }));

      setGroups(newGroups);
    } catch (err) {
      console.error('[MCPHubSettingsPanel] 加载失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  const toggleGroup = (id: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, expanded: !g.expanded } : g)),
    );
  };

  const totalTools = groups.reduce((sum, g) => sum + g.tools.length, 0);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">MCP Hub</h3>
          <p className="mt-0.5 text-xs text-white/50">
            {groups.length} 个服务器 · {totalTools} 个工具
          </p>
        </div>
        <button
          onClick={loadTools}
          disabled={loading}
          className="flex h-7 items-center gap-1 rounded-md border border-white/10 px-2 text-xs text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          刷新
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {groups.map((group) => (
          <div
            key={group.id}
            className="rounded-lg border border-white/5 bg-white/[0.02] transition-colors hover:border-white/10"
          >
            <button
              onClick={() => toggleGroup(group.id)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            >
              {group.expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-white/50" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-white/50" />
              )}
              <Server className="h-3.5 w-3.5 text-blue-400" />
              <span className="flex-1 text-xs font-medium text-white">{group.label}</span>
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                {group.tools.length}
              </span>
              <Circle className={cn('h-2 w-2', group.tools.length > 0 ? 'fill-emerald-400 text-emerald-400' : 'fill-white/20 text-white/20')} />
            </button>

            {group.expanded && (
              <div className="border-t border-white/5 px-3 py-2">
                {group.tools.length === 0 ? (
                  <p className="py-2 text-center text-xs text-white/30">暂无工具</p>
                ) : (
                  <div className="space-y-1.5">
                    {group.tools.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-white/5"
                      >
                        <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-amber-400/70" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white/80">{tool.name}</p>
                          {tool.description && (
                            <p className="mt-0.5 text-[10px] leading-tight text-white/40">
                              {tool.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(MCPHubSettingsPanel);
