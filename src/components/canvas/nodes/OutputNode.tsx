import { memo, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NodeProps, NodeResizer, useStore, type Node } from '@xyflow/react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import {
  X as CloseIcon,
  Download,
  ExternalLink,
  Image,
  Video,
  FolderDown,
  Copy,
  Send,
  Scissors,
} from 'lucide-react';
import {
  sendCanvasMediaToClipEditor,
  type ClipImportItem,
} from '@/services/canvas-clip-bridge-service';
import OutputMiniTimeline from './OutputMiniTimeline';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { nodeEventBus } from '@/lib/nodeEventBus';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { aicgGlass } from './aicg-node-glass';
import { useNodeControllerCollapse } from '@/hooks/useNodeControllerCollapse';
import {
  type NodeControllerAction,
} from './NodeControllerCapabilityPanel';
import NodeControllerV2Panel from './NodeControllerV2Panel';
import { getNodeControllerPreset } from '@/services/node-controller-capability-registry';
import { getSafeRenderableMediaUrl } from '@/lib/media-url';

interface OutputNodeData {
  type: 'output';
  label?: string;
  isExpanded?: boolean;
  isControllerCollapsed?: boolean;
  receivedImageUrl?: string;
  receivedVideoUrl?: string;
  receivedAudioUrl?: string;
  audioUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  // ✅ P1-6：支持多类型累积，避免互相覆盖
  mediaTypes?: string[];
  activeMediaType?: 'image' | 'video' | 'audio';
}

const AI_VIDEO_NODE_TYPES = new Set(['aiVideo', 'aicgVideoGen', 'videoGen', 'advancedVideoGen']);

const GENERATABLE_NODE_TYPES = new Set([
  'aiVideo', 'aicgVideoGen', 'videoGen', 'advancedVideoGen',
  'aicgImageGen', 'imageGen', 'aiImage', 'unifiedImageStudio', 'imageAnalysis', 'inpainting', 'outpainting',
  'audioGen', 'audioInput',
]);

function getNodeType(node: Node): string {
  const data = node.data as Record<string, unknown> | undefined;
  return String(data?.type || node.type || '');
}

function getVideoResultUrls(node: Node): string[] {
  const data = node.data as Record<string, unknown> | undefined;
  const task = data?.task as Record<string, unknown> | undefined;
  const urls = [
    data?.receivedVideoUrl,
    data?.videoUrl,
    data?.resultUrl,
    task?.resultUrl,
    ...(Array.isArray(data?.resultUrls) ? data.resultUrls : []),
    ...(Array.isArray(task?.resultUrls) ? task.resultUrls : []),
  ];
  return Array.from(new Set(urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)));
}

function hasVideoResult(node: Node): boolean {
  return getVideoResultUrls(node).length > 0;
}

function getNodeLabel(node: Node): string {
  const data = node.data as Record<string, unknown> | undefined;
  return String(data?.label || data?.title || node.id.slice(0, 6));
}

function isVideoProcessing(node: Node): boolean {
  const data = node.data as Record<string, unknown> | undefined;
  const task = data?.task as Record<string, unknown> | undefined;
  return task?.status === 'pending' || task?.status === 'processing';
}

function hasUsablePrompt(node: Node): boolean {
  const data = node.data as Record<string, unknown> | undefined;
  const params = data?.params as Record<string, unknown> | undefined;
  return String(data?.prompt || params?.prompt || '').trim().length > 0;
}

function hasGenResult(node: Node): boolean {
  return getVideoResultUrls(node).length > 0 || hasImageResult(node) || hasAudioResult(node);
}

function hasImageResult(node: Node): boolean {
  const data = node.data as Record<string, unknown> | undefined;
  const task = data?.task as Record<string, unknown> | undefined;
  return Boolean(data?.imageUrl || data?.resultUrl || task?.resultUrl ||
    (Array.isArray(data?.resultUrls) && data.resultUrls.length > 0) ||
    (Array.isArray(task?.resultUrls) && task.resultUrls.length > 0));
}

function hasAudioResult(node: Node): boolean {
  const data = node.data as Record<string, unknown> | undefined;
  return Boolean(data?.audioUrl || data?.receivedAudioUrl);
}

function isGenProcessing(node: Node): boolean {
  const data = node.data as Record<string, unknown> | undefined;
  const task = data?.task as Record<string, unknown> | undefined;
  return task?.status === 'pending' || task?.status === 'processing';
}

function isNodeRenderable(node: Node): boolean {
  return !hasGenResult(node) && !isGenProcessing(node) && hasUsablePrompt(node);
}

const OutputNode = memo(({ data, selected, id }: NodeProps) => {
  const nodeData = data as unknown as OutputNodeData;
  const [isExpanded, setIsExpanded] = useState(nodeData.isExpanded ?? true);
  const { controlsCollapsed, onPreviewDoubleClick, collapseController } = useNodeControllerCollapse(
    id as string,
    nodeData
  );
  const [hasConnections, setHasConnections] = useState(false);
  const [connectedNodeCount, setConnectedNodeCount] = useState(0);
  // ✅ P1-6：用户可切换显示类型，优先使用 activeMediaType，回退到 mediaType
  const [activeMediaType, setActiveMediaType] = useState<'image' | 'video' | 'audio'>(
    nodeData.activeMediaType || nodeData.mediaType || 'image'
  );
  const updateNodeData = canvasStoreApi.updateNodeData;
  const deleteNode = canvasStoreApi.deleteNode;
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);

  // ✅ P1-6：当 nodeData.activeMediaType 变化时同步本地 state（例如新连接同步进来）
  useEffect(() => {
    const next = nodeData.activeMediaType || nodeData.mediaType;
    if (next && next !== activeMediaType) {
      setActiveMediaType(next);
    }
  }, [nodeData.activeMediaType, nodeData.mediaType, activeMediaType]);

  // ✅ P1-6：当前显示类型，优先用户选择，回退到同步过来的 mediaType
  const currentMediaType: 'image' | 'video' | 'audio' =
    activeMediaType || nodeData.activeMediaType || nodeData.mediaType || 'image';
  const availableMediaTypes: string[] = Array.isArray(nodeData.mediaTypes) && nodeData.mediaTypes.length > 0
    ? nodeData.mediaTypes
    : [currentMediaType];

  const connectedUpstreamNodes = edges
    .filter((edge) => edge.target === id)
    .map((edge) => nodes.find((node) => node.id === edge.source))
    .filter((node): node is Node => Boolean(node));
  const connectedVideoNodes = connectedUpstreamNodes.filter((node) => AI_VIDEO_NODE_TYPES.has(getNodeType(node)));
  const renderableVideoNodes = connectedVideoNodes.filter(
    (node) => !hasVideoResult(node) && !isVideoProcessing(node) && hasUsablePrompt(node)
  );
  const completedVideoNodes = connectedVideoNodes.filter(hasVideoResult);
  const skippedVideoNodeCount = connectedVideoNodes.length - renderableVideoNodes.length;

  const connectedGenNodes = connectedUpstreamNodes.filter((node) => GENERATABLE_NODE_TYPES.has(getNodeType(node)));
  const renderableGenNodes = connectedGenNodes.filter(isNodeRenderable);
  const completedGenNodes = connectedGenNodes.filter(hasGenResult);
  const skippedGenNodeCount = connectedGenNodes.length - renderableGenNodes.length;

  useEffect(() => {
    const inputEdges = edges.filter((edge) => edge.target === id);
    setHasConnections(inputEdges.length > 0);
    setConnectedNodeCount(inputEdges.length);
  }, [edges, id]);

  useEffect(() => {
    const handleMediaReceived = (event: Event) => {
      const detail = (
        event as CustomEvent<{ nodeId: string; mediaUrl: string; mediaType: 'image' | 'video' | 'audio' }>
      ).detail;
      if (!detail || detail.nodeId !== id) return;
      const { mediaUrl, mediaType } = detail;
      updateNodeData(id as string, {
        receivedImageUrl: mediaType === 'image' ? mediaUrl : undefined,
        receivedVideoUrl: mediaType === 'video' ? mediaUrl : undefined,
        receivedAudioUrl: mediaType === 'audio' ? mediaUrl : undefined,
        audioUrl: mediaType === 'audio' ? mediaUrl : undefined,
        mediaType,
        output: mediaUrl,
        imageUrl: mediaType === 'image' ? mediaUrl : undefined,
        url: mediaUrl,
      });
    };

    window.addEventListener('node-output-media', handleMediaReceived);
    return () => window.removeEventListener('node-output-media', handleMediaReceived);
  }, [id, updateNodeData]);

  const handleToggleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
      updateNodeData(id as string, { isExpanded: !isExpanded });
    },
    [id, isExpanded, updateNodeData]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteNode(id as string);
      nodeEventBus.emitNodeDeleted(id as string);
    },
    [id, deleteNode]
  );

  const handleDownload = useCallback(() => {
    const mediaUrl =
      currentMediaType === 'image'
        ? nodeData.receivedImageUrl
        : currentMediaType === 'audio'
          ? nodeData.receivedAudioUrl || nodeData.audioUrl
          : nodeData.receivedVideoUrl;

    if (mediaUrl) {
      const link = document.createElement('a');
      link.href = mediaUrl;
      const extension = currentMediaType === 'image' ? 'png' : currentMediaType === 'audio' ? 'mp3' : 'mp4';
      link.download = `output_${Date.now()}.${extension}`;
      link.click();
    }
  }, [nodeData.audioUrl, nodeData.receivedAudioUrl, nodeData.receivedImageUrl, nodeData.receivedVideoUrl, currentMediaType]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!nodeData.receivedImageUrl) return;
    try {
      const response = await fetch(nodeData.receivedImageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      toast.success('图片已复制到剪贴板');
    } catch (err) {
      console.error('[OutputNode] 复制图片到剪贴板失败:', err);
      toast.error('复制失败');
    }
  }, [nodeData.receivedImageUrl]);

  const handleSendToAIClip = useCallback(() => {
    const items: ClipImportItem[] = [];
    if (nodeData.receivedVideoUrl) {
      items.push({ url: nodeData.receivedVideoUrl, type: 'video', name: '成片视频' });
    }
    const audioUrl = nodeData.receivedAudioUrl || nodeData.audioUrl;
    if (audioUrl) {
      items.push({ url: audioUrl, type: 'audio', name: '输出音频' });
    }
    if (nodeData.receivedImageUrl) {
      items.push({ url: nodeData.receivedImageUrl, type: 'image', name: '成片图片', duration: 3 });
    }
    if (items.length === 0) {
      toast.warning('请先连接上游节点并接收媒体');
      return;
    }
    sendCanvasMediaToClipEditor(items, id as string);
    toast.success('正在打开 AI 剪辑板块…');
  }, [id, nodeData.audioUrl, nodeData.receivedAudioUrl, nodeData.receivedImageUrl, nodeData.receivedVideoUrl]);

  const handleSendToDownstream = useCallback(() => {
    const mediaUrl =
      currentMediaType === 'image'
        ? nodeData.receivedImageUrl
        : currentMediaType === 'audio'
          ? nodeData.receivedAudioUrl || nodeData.audioUrl
          : nodeData.receivedVideoUrl;
    if (!mediaUrl) {
      toast.warning('没有可发送的媒体');
      return;
    }
    updateNodeData(id as string, {
      output: mediaUrl,
      imageUrl: currentMediaType === 'image' ? mediaUrl : undefined,
      audioUrl: currentMediaType === 'audio' ? mediaUrl : undefined,
      url: mediaUrl,
    });
    toast.success('已更新输出数据，下游节点可接收');
  }, [
    id,
    nodeData.receivedImageUrl,
    nodeData.receivedVideoUrl,
    nodeData.receivedAudioUrl,
    nodeData.audioUrl,
    currentMediaType,
    updateNodeData,
  ]);

  const handleBatchRenderConnectedVideos = useCallback(() => {
    const syncedCount = connectedGenNodes.reduce((count, node) => count + syncDownstreamFromNode(node.id), 0);
    if (renderableGenNodes.length === 0) {
      if (syncedCount > 0) {
        toast.success('已同步已完成的节点输出');
        return;
      }
      if (connectedGenNodes.length === 0) {
        toast.warning('请先连接生成节点到输出节点');
        return;
      }
      toast.warning('没有可提交的生成节点，请检查是否已生成、正在生成或缺少提示词');
      return;
    }

    const count = renderableGenNodes.length;
    const delay = count > 100 ? 15 : count > 50 ? 30 : 120;
    renderableGenNodes.forEach((node, index) => {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('execute-node', { detail: { nodeId: node.id } }));
      }, index * delay);
    });

    toast.success(`已提交 ${count} 个节点统一生成${skippedGenNodeCount > 0 ? `，跳过 ${skippedGenNodeCount} 个` : ''}`);
  }, [connectedGenNodes, renderableGenNodes, skippedGenNodeCount]);

  const handleImportConnectedVideosToAIClip = useCallback(() => {
    const items: ClipImportItem[] = completedGenNodes.flatMap((node) => {
      const nodeType = getNodeType(node);
      const label = getNodeLabel(node);
      const videoUrls = getVideoResultUrls(node);
      const videoItems = videoUrls.map((url, index) => ({
        url, type: 'video' as const, name: `${label}${index > 0 ? `-${index + 1}` : ''}`,
      }));
      const data = node.data as Record<string, unknown> | undefined;
      const task = data?.task as Record<string, unknown> | undefined;
      const imageUrls = Array.from(new Set([
        String(data?.imageUrl || ''), String(data?.resultUrl || ''), String(task?.resultUrl || ''),
        ...(Array.isArray(data?.resultUrls) ? data.resultUrls : []),
        ...(Array.isArray(task?.resultUrls) ? task.resultUrls : []),
      ].filter((u): u is string => u.trim().length > 0 && !videoUrls.includes(u))));
      const imageItems = imageUrls.map((url, index) => ({
        url, type: 'image' as const, name: `${label}${index > 0 ? `-${index + 1}` : ''}`, duration: 3,
      }));
      const audioUrl = String(data?.audioUrl || data?.receivedAudioUrl || '');
      const audioItems = audioUrl ? [{ url: audioUrl, type: 'audio' as const, name: `${label}-audio` }] : [];
      const isVideoNode = AI_VIDEO_NODE_TYPES.has(nodeType);
      return isVideoNode ? videoItems : [...videoItems, ...imageItems, ...audioItems];
    });

    if (items.length === 0) {
      toast.warning('没有可导入的已完成节点，请先生成内容');
      return;
    }

    sendCanvasMediaToClipEditor(items, id as string);
    toast.success(`已导入 ${items.length} 个媒体到 AI 剪辑板块`);
  }, [completedGenNodes, id]);

  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'video' | 'audio' } | null>(
    null
  );

  const handlePreviewMedia = useCallback(() => {
    const mediaUrl =
      currentMediaType === 'image'
        ? nodeData.receivedImageUrl
        : currentMediaType === 'audio'
          ? nodeData.receivedAudioUrl || nodeData.audioUrl
          : nodeData.receivedVideoUrl;

    const safeMediaUrl = getSafeRenderableMediaUrl(mediaUrl);
    if (safeMediaUrl) {
      setPreviewMedia({ url: safeMediaUrl, type: currentMediaType as 'image' | 'video' | 'audio' });
    }
  }, [nodeData.audioUrl, nodeData.receivedAudioUrl, nodeData.receivedImageUrl, nodeData.receivedVideoUrl, currentMediaType]);

  const rawDisplayMediaUrl =
    currentMediaType === 'image'
      ? nodeData.receivedImageUrl
      : currentMediaType === 'audio'
        ? nodeData.receivedAudioUrl || nodeData.audioUrl
        : nodeData.receivedVideoUrl;
  const displayMediaUrl = getSafeRenderableMediaUrl(rawDisplayMediaUrl);
  const hasMedia = Boolean(displayMediaUrl);
  const outputPreset = getNodeControllerPreset('output');
  const outputActions: NodeControllerAction[] = outputPreset.resultActions
    .filter((action) => action.id !== 'copy' || currentMediaType === 'image')
    .map((action) => ({
      ...action,
      onClick:
        action.id === 'send-to-clip'
          ? handleSendToAIClip
          : action.id === 'download'
            ? handleDownload
            : action.id === 'preview'
              ? handlePreviewMedia
              : action.id === 'send-downstream'
                ? handleSendToDownstream
                : undefined,
    }));

  return (
    <div className="relative min-w-[280px] max-w-[400px] border-0 group">
      <NodeResizer minWidth={280} minHeight={200} handleClassName="!opacity-0" lineClassName="!hidden" />

      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="output"
        inputId="image"
        extraInputs={['video', 'audio']}
        outputId="output"
        outputQuickAdd={false}
        inputTip="媒体输入"
        outputTip="输出"
      />

      <div className={selected ? aicgGlass.videoComposeFrameSelected : aicgGlass.videoComposeFrame}>
        <div className={aicgGlass.videoComposeInnerRing} />
        <AICGNodeShell
          variant="glass-stack"
          aicgType="tool"
          title="成片导出"
          subtitle={hasConnections ? `已连接 ${connectedNodeCount} 个上游` : '连接生成节点接收输出'}
          selected={selected}
          width="100%"
          className="gap-0 [&_.aicg-glass-control]:rounded-t-none [&_.aicg-glass-control]:border-0 [&_.aicg-glass-control]:bg-transparent [&_.aicg-glass-control]:shadow-none [&_.aicg-glass-preview]:rounded-b-none [&_.aicg-glass-preview]:border-0 [&_.aicg-glass-preview]:bg-transparent [&_.aicg-glass-preview]:shadow-none"
          onDelete={() => {
            deleteNode(id as string);
            nodeEventBus.emitNodeDeleted(id as string);
          }}
          onControllerCollapse={collapseController}
          onPreviewDoubleClick={onPreviewDoubleClick}
          controlsCollapsed={controlsCollapsed}
          headerExtra={
            <button type="button" onClick={handleToggleExpand} className={aicgGlass.iconBtn}>
              {isExpanded ? '−' : '+'}
            </button>
          }
          preview={
            hasMedia ? (
              <div
                className={cn(
                  aicgGlass.previewMedia,
                  'flex aspect-video items-center justify-center'
                )}
              >
                {currentMediaType === 'video' ? (
                  <video
                    src={displayMediaUrl}
                    className="max-h-full max-w-full object-contain"
                    controls
                  />
                ) : currentMediaType === 'audio' ? (
                  <div className="flex w-full flex-col items-center gap-3 px-6 text-white/65">
                    <Scissors className="h-12 w-12 text-white/22" />
                    <audio
                      src={displayMediaUrl}
                      className="w-full"
                      controls
                      data-testid="output-node-audio-player"
                    />
                  </div>
                ) : (
                  <img
                    src={displayMediaUrl}
                    alt="输出结果"
                    className="max-h-full max-w-full object-contain"
                  />
                )}
              </div>
            ) : (
              <div className={cn(aicgGlass.previewEmpty, 'relative py-10')}>
                <button
                  type="button"
                  onClick={handleDelete}
                  aria-label="关闭输出节点"
                  title="关闭"
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-white/45 transition-colors hover:bg-white/12 hover:text-white"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
                <FolderDown className="mb-1 h-6 w-6 text-white/50" />
                <p className="text-center text-[10px] text-white/55">连接生成节点接收输出</p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleBatchRenderConnectedVideos();
                  }}
                  className="nodrag nowheel mt-2 flex items-center gap-1.5 rounded-lg border border-white/16 bg-white/[0.08] px-3 py-1.5 text-[11px] font-semibold text-white/78 transition-colors hover:border-white/28 hover:bg-white/[0.12] hover:text-white"
                  title="批量提交已连接且未渲染的生成节点（支持 200 个）"
                >
                  <Send className="h-3.5 w-3.5" />
                  输出
                </button>
                {completedGenNodes.length > 0 ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleImportConnectedVideosToAIClip();
                    }}
                    className="nodrag nowheel flex items-center gap-1.5 rounded-lg border border-white/16 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white/70 transition-colors hover:border-white/28 hover:bg-white/[0.1] hover:text-white"
                    title="一键导入已连接且已生成的节点到 AI 剪辑板块"
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    导入剪辑 {completedGenNodes.length}
                  </button>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  <Image className="h-3.5 w-3.5 text-white/58" />
                  <Video className="h-3.5 w-3.5 text-white/58" />
                </div>
                {connectedGenNodes.length > 0 ? (
                  <p className="text-center text-[9px] text-white/35">
                    可渲染 {renderableGenNodes.length} / 可导入 {completedGenNodes.length} / 已连接 {connectedGenNodes.length}
                  </p>
                ) : null}
              </div>
            )
          }
          controls={
            isExpanded && !controlsCollapsed && hasMedia ? (
              <>
                {/* ✅ P1-6：多类型切换按钮 */}
                {availableMediaTypes.length > 1 ? (
                  <div className="flex items-center gap-1 px-2.5 pt-2">
                    {availableMediaTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = type as 'image' | 'video' | 'audio';
                          setActiveMediaType(next);
                          updateNodeData(id as string, { activeMediaType: next });
                        }}
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                          currentMediaType === type
                            ? 'bg-white/[0.08] text-white'
                            : 'bg-white/5 text-white/55 hover:bg-white/10'
                        )}
                      >
                        {type === 'audio' ? '音频' : type === 'video' ? '视频' : '图片'}
                      </button>
                    ))}
                  </div>
                ) : null}
                {currentMediaType === 'video' && displayMediaUrl ? (
                  <OutputMiniTimeline videoUrl={displayMediaUrl} />
                ) : null}
                {/* outputActions 已经由下方的 NodeControllerV2Panel「交付动作」分区渲染，
                    这里不再重复渲染，否则同一批按钮会出现两次。 */}
                <NodeControllerV2Panel
                  title={outputPreset.v2.title}
                  subtitle={outputPreset.v2.subtitle}
                  status={hasMedia ? 'done' : hasConnections ? 'ready' : 'idle'}
                  onClose={collapseController}
                  sections={[
                    { id: 'result', label: outputPreset.v2.sections.result || '结果动作', actions: outputActions },
                  ]}
                  summary={[
                    {
                      id: 'media',
                      label: currentMediaType === 'audio' ? '音频' : currentMediaType === 'video' ? '视频' : '图片',
                    },
                    {
                      id: 'connections',
                      label: hasConnections ? `${connectedNodeCount} 个上游` : '未连接',
                    },
                  ]}
                  className="mx-2.5 mt-2"
                />
                <div className="grid grid-cols-2 gap-1.5 p-2.5">
                  {connectedGenNodes.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleBatchRenderConnectedVideos}
                      className={aicgGlass.actionBtnPrimary}
                      title="批量提交已连接且未渲染的生成节点（支持 200 个）"
                    >
                      <Send className="h-3.5 w-3.5" />
                      输出 {renderableGenNodes.length > 0 ? renderableGenNodes.length : ''}
                    </button>
                  ) : null}
                  {completedGenNodes.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleImportConnectedVideosToAIClip}
                      className={aicgGlass.actionBtnPrimary}
                      title="一键导入已连接且已生成的节点到 AI 剪辑板块"
                    >
                      <Scissors className="h-3.5 w-3.5" />
                      导入剪辑 {completedGenNodes.length}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSendToAIClip}
                    className={connectedGenNodes.length > 0 || completedGenNodes.length > 0 ? aicgGlass.actionBtn : aicgGlass.actionBtnPrimary}
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    AI 剪辑
                  </button>
                  <button type="button" onClick={handleDownload} className={aicgGlass.actionBtn}>
                    <Download className="h-3.5 w-3.5" />
                    下载
                  </button>
                  <button
                    type="button"
                    onClick={handlePreviewMedia}
                    className={aicgGlass.actionBtn}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    预览
                  </button>
                  {currentMediaType === 'image' ? (
                    <button
                      type="button"
                      onClick={handleCopyToClipboard}
                      className={aicgGlass.actionBtn}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      复制
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSendToDownstream}
                    className={aicgGlass.actionBtn}
                  >
                    <Send className="h-3.5 w-3.5" />
                    发送下游
                  </button>
                </div>
              </>
            ) : null
          }
        />
      </div>

      {previewMedia &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setPreviewMedia(null)}
          >
            <div
              className="relative flex items-center justify-center w-[90vw] h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {previewMedia.type === 'image' ? (
                <img
                  src={previewMedia.url}
                  alt="预览"
                  className="max-w-full max-h-full rounded-lg object-contain"
                />
              ) : previewMedia.type === 'audio' ? (
                <div className="flex w-full max-w-2xl flex-col items-center gap-5 rounded-xl border border-white/10 bg-white/[0.04] p-8 text-white">
                  <Scissors className="h-14 w-14 text-white/28" />
                  <audio
                    src={previewMedia.url}
                    controls
                    autoPlay
                    className="w-full"
                  />
                </div>
              ) : (
                <video
                  src={previewMedia.url}
                  controls
                  className="max-w-full max-h-full rounded-lg"
                />
              )}
              <button
                className="absolute top-2 right-2 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                onClick={() => setPreviewMedia(null)}
              >
                <CloseIcon size={20} />
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});

OutputNode.displayName = 'OutputNode';
export default OutputNode;
