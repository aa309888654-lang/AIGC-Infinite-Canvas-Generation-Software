import React, { useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Image, Video, FileText, Music, Layers, Upload, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NODE_TYPES } from '@/types/node-system';

interface WorkflowNodeGraphPreviewProps {
  nodes: Node[];
  edges: Edge[];
}

const NODE_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  imageInput: Image,
  aiImage: Image,
  aicgImageGen: Image,
  videoInput: Video,
  aiVideo: Video,
  aicgVideoGen: Video,
  audioGen: Music,
  audioInput: Music,
  script: FileText,
  aiGenText: FileText,
  adCopyText: FileText,
  brandCopyText: FileText,
  localMatting: Layers,
  videoUpscale: Zap,
  gridDirector: Video,
  scriptStoryboard: Video,
  storyboardMaker: Video,
  storyboardEdit: Video,
  characterConsistency: Layers,
  output: Upload,
  videoCompose: Video,
  batchProcess: Zap,
  frameExtractor: Video,
  characterLibrary: FileText,
  sceneLibrary: Image,
  propLibrary: FileText,
  director3D: Video,
  multiAngle: Image,
  panorama360: Video,
  vr360Preview: Video,
  gridSplitter: Layers,
  imageCollage: Layers,
};

const NODE_COLOR_MAP: Record<string, string> = {
  imageInput: 'bg-emerald-500/20 border-emerald-500/50',
  aiImage: 'bg-violet-500/20 border-violet-500/50',
  aicgImageGen: 'bg-pink-500/20 border-pink-500/50',
  videoInput: 'bg-blue-500/20 border-blue-500/50',
  aiVideo: 'bg-orange-500/20 border-orange-500/50',
  aicgVideoGen: 'bg-pink-500/20 border-pink-500/50',
  audioGen: 'bg-pink-500/20 border-pink-500/50',
  audioInput: 'bg-pink-500/20 border-pink-500/50',
  script: 'bg-emerald-500/20 border-emerald-500/50',
  aiGenText: 'bg-violet-500/20 border-violet-500/50',
  adCopyText: 'bg-orange-500/20 border-orange-500/50',
  brandCopyText: 'bg-purple-500/20 border-purple-500/50',
  localMatting: 'bg-emerald-500/20 border-emerald-500/50',
  videoUpscale: 'bg-cyan-500/20 border-cyan-500/50',
  gridDirector: 'bg-amber-500/20 border-amber-500/50',
  scriptStoryboard: 'bg-amber-500/20 border-amber-500/50',
  storyboardMaker: 'bg-amber-500/20 border-amber-500/50',
  storyboardEdit: 'bg-amber-500/20 border-amber-500/50',
  characterConsistency: 'bg-emerald-500/20 border-emerald-500/50',
  output: 'bg-cyan-500/20 border-cyan-500/50',
  videoCompose: 'bg-violet-500/20 border-violet-500/50',
  batchProcess: 'bg-indigo-500/20 border-indigo-500/50',
  frameExtractor: 'bg-amber-500/20 border-amber-500/50',
  characterLibrary: 'bg-violet-500/20 border-violet-500/50',
  sceneLibrary: 'bg-emerald-500/20 border-emerald-500/50',
  propLibrary: 'bg-orange-500/20 border-orange-500/50',
  director3D: 'bg-violet-500/20 border-violet-500/50',
  multiAngle: 'bg-violet-500/20 border-violet-500/50',
  panorama360: 'bg-cyan-500/20 border-cyan-500/50',
  vr360Preview: 'bg-cyan-500/20 border-cyan-500/50',
  gridSplitter: 'bg-cyan-500/20 border-cyan-500/50',
  imageCollage: 'bg-violet-500/20 border-violet-500/50',
};

function getNodeInfo(node: Node) {
  const data = node.data as Record<string, unknown>;
  const nodeType = node.type as string;
  const def = NODE_TYPES.find((n) => n.id === nodeType);
  
  const label = data.label as string || data.title as string || def?.name || nodeType;
  const prompt = data.prompt as string || (data.params as Record<string, unknown>)?.prompt as string || '';
  const imageUrl = data.imageUrl as string || data.previewImageUrl as string || '';
  const videoUrl = data.videoUrl as string || data.previewVideoUrl as string || '';
  
  return {
    type: nodeType,
    label,
    prompt,
    imageUrl,
    videoUrl,
    color: NODE_COLOR_MAP[nodeType] || 'bg-gray-500/20 border-gray-500/50',
    Icon: NODE_ICON_MAP[nodeType] || Zap,
    position: node.position,
  };
}

const WorkflowNodeGraphPreview: React.FC<WorkflowNodeGraphPreviewProps> = ({ nodes, edges }) => {
  const nodeInfoList = useMemo(() => nodes.map(getNodeInfo), [nodes]);
  
  const positions = useMemo(() => {
    const posMap = new Map<string, { x: number; y: number }>();
    nodes.forEach((node) => {
      posMap.set(node.id, node.position);
    });
    return posMap;
  }, [nodes]);
  
  const maxX = useMemo(() => {
    return Math.max(...nodes.map((n) => n.position.x)) + 220;
  }, [nodes]);
  
  const maxY = useMemo(() => {
    return Math.max(...nodes.map((n) => n.position.y)) + 180;
  }, [nodes]);

  return (
    <div className="relative bg-[#181818] rounded-xl overflow-hidden border border-[#2D2D2D]">
      <svg className="absolute inset-0 w-full h-full" style={{ minHeight: Math.max(maxY, 300), minWidth: Math.max(maxX, 600) }}>
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 8 4, 0 8" fill="#007AFF" />
          </marker>
        </defs>
        {edges.map((edge) => {
          const sourcePos = positions.get(edge.source);
          const targetPos = positions.get(edge.target);
          if (!sourcePos || !targetPos) return null;
          
          const sourceX = sourcePos.x + 110;
          const sourceY = sourcePos.y + 60;
          const targetX = targetPos.x;
          const targetY = targetPos.y + 60;
          
          const midX = (sourceX + targetX) / 2;
          
          return (
            <path
              key={edge.id}
              d={`M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`}
              stroke="#007AFF"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead)"
              className="opacity-60"
            />
          );
        })}
      </svg>

      <div className="relative" style={{ minHeight: Math.max(maxY, 300), minWidth: Math.max(maxX, 600) }}>
        {nodeInfoList.map((info, index) => (
          <div
            key={index}
            className={cn(
              'absolute w-[220px] rounded-lg border bg-[#242428] overflow-hidden transition-all hover:scale-105 hover:z-10',
              info.color
            )}
            style={{
              left: info.position.x,
              top: info.position.y,
            }}
          >
            <div className="p-3 border-b border-[#2D2D2D]">
              <div className="flex items-center gap-2">
                <info.Icon size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-white truncate">{info.label}</span>
              </div>
            </div>

            {info.videoUrl ? (
              <div className="aspect-video bg-[#151515]">
                <video
                  src={info.videoUrl}
                  className="w-full h-full object-cover"
                  controls
                  loop
                  muted
                  playsInline
                />
              </div>
            ) : info.imageUrl ? (
              <div className="aspect-video bg-[#151515]">
                <img
                  src={info.imageUrl}
                  alt={info.label}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : null}

            {info.prompt && (
              <div className="p-3">
                <div className="text-xs text-gray-500 mb-1">提示词</div>
                <div className="text-xs text-gray-300 line-clamp-3">
                  {info.prompt.length > 100 ? info.prompt.substring(0, 100) + '...' : info.prompt}
                </div>
              </div>
            )}

            {!info.imageUrl && !info.prompt && (
              <div className="p-3 text-center text-gray-500 text-xs">
                {info.type === 'output' ? '输出节点' : '处理节点'}
              </div>
            )}

            <div className="absolute right-2 top-2 w-2 h-2 rounded-full bg-green-500" />
            
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-8 rounded-r bg-[#007AFF] opacity-60" />
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-8 rounded-l bg-[#007AFF] opacity-60" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkflowNodeGraphPreview;