import React, { useState } from 'react';
import { Node } from '@xyflow/react';
import { Panel } from '@xyflow/react';

interface NodeSearchPanelProps {
  nodes: Node[];
  onJumpToNode: (nodeId: string) => void;
  onClose: () => void;
}

const NodeSearchPanel: React.FC<NodeSearchPanelProps> = ({
  nodes,
  onJumpToNode,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  const filteredNodes = searchQuery.trim()
    ? nodes.filter(n => {
        const type = n.data?.type?.toString().toLowerCase() || '';
        const label = n.data?.label?.toString().toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        return type.includes(query) || label.includes(query);
      })
    : nodes;

  return (
    <Panel position="top-center" className="top-4">
      <div
        className="bg-[#1F1F1F] border border-white/10 rounded-xl shadow-2xl w-80 overflow-hidden"
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="p-3 border-b border-white/10">
          <input
            type="text"
            placeholder="搜索节点... (Ctrl+Space)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 bg-[#2A2A2A] border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#4B21FF]"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filteredNodes.length === 0 ? (
            <div className="p-4 text-center text-white/40 text-sm">没有找到节点</div>
          ) : (
            filteredNodes.map((node) => (
              <button
                key={node.id}
                onClick={() => onJumpToNode(node.id)}
                className="w-full px-4 py-3 text-left hover:bg-white/5 flex items-center justify-between"
              >
                <div>
                  <div className="text-sm text-white">{String(node.data?.type) || 'Unknown'}</div>
                  <div className="text-xs text-white/40">ID: {node.id.slice(0, 8)}...</div>
                </div>
                <div className="text-xs text-white/40">
                  {Math.round(node.position.x)}, {Math.round(node.position.y)}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="p-2 border-t border-white/10 text-xs text-white/40 flex justify-between px-4">
          <span>↑↓ 导航</span>
          <span>Enter 跳转</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </Panel>
  );
};

export default NodeSearchPanel;
