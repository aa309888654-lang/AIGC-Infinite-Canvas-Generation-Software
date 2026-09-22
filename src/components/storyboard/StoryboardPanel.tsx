import { memo, useCallback, useMemo } from 'react';
import { Clapperboard, Download, Play, RefreshCw, Scissors, Trash2, Wand2, Workflow, X } from 'lucide-react';
import { toast } from 'sonner';
import { useShotStore } from '@/store/useShotStore';
import { useGenerationVersionStore } from '@/store/useGenerationVersionStore';
import { useShotExecutionStore } from '@/store/useShotExecutionStore';
import {
  buildClipItemsFromStoryboardExport,
  buildStoryboardExport,
  downloadStoryboardExport,
} from '@/services/shot-export-service';
import { sendCanvasMediaToClipEditor } from '@/services/canvas-clip-bridge-service';
import type { Shot } from '@/types/shot-system';
import ShotCard from './ShotCard';
import ShotExecutionQueuePanel from './ShotExecutionQueuePanel';

interface StoryboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateShotNodes: (shot: Shot) => void;
  onCreateAllShotNodes: (shots: Shot[]) => void;
  onExecuteShot?: (shot: Shot) => void;
  onExecuteAllShots?: (shots: Shot[]) => void;
  onFocusShotNodes?: (shot: Shot) => void;
  onSyncShotResults?: () => number;
}

const DEFAULT_SCRIPT = `女孩推开旧屋的门，发现桌上放着一台发光的相机。
她拿起相机对准窗外，城市夜景突然变成未来霓虹街道。
一个陌生少年从画面里回头，像是早就在等她。
女孩按下快门，整间屋子被蓝色光芒吞没。`;

function StoryboardPanel({
  isOpen,
  onClose,
  onCreateShotNodes,
  onCreateAllShotNodes,
  onExecuteShot,
  onExecuteAllShots,
  onFocusShotNodes,
  onSyncShotResults,
}: StoryboardPanelProps) {
  const {
    scriptDraft,
    shots,
    selectedShotId,
    setScriptDraft,
    generateFromScript,
    updateShot,
    moveShot,
    selectShotVersion,
    removeShot,
    selectShot,
    clearShots,
  } = useShotStore();
  const versions = useGenerationVersionStore((state) => state.versions);
  const clearVersions = useGenerationVersionStore((state) => state.clearVersions);
  const queueStatus = useShotExecutionStore((state) => state.status);
  const queueRunning = queueStatus === 'running';
  const hasRunnableShots = useMemo(
    () => shots.some((shot) => shot.nodeLinks?.imageNodeId || shot.nodeLinks?.videoNodeId),
    [shots]
  );
  const exportDocument = useMemo(() => buildStoryboardExport(shots, versions), [shots, versions]);

  const handleGenerate = useCallback(() => {
    const source = scriptDraft.trim() || DEFAULT_SCRIPT;
    const nextShots = generateFromScript(source);
    toast.success(`已拆出 ${nextShots.length} 个镜头`);
  }, [generateFromScript, scriptDraft]);

  const handleCreateAll = useCallback(() => {
    if (shots.length === 0) {
      toast.info('请先生成镜头');
      return;
    }
    onCreateAllShotNodes(shots);
  }, [onCreateAllShotNodes, shots]);

  const handleExecuteAll = useCallback(() => {
    if (shots.length === 0) {
      toast.info('请先生成镜头');
      return;
    }
    if (!hasRunnableShots) {
      toast.info('请先为镜头创建节点组');
      return;
    }
    if (queueRunning) {
      toast.info('分镜队列正在执行中');
      return;
    }
    onExecuteAllShots?.(shots);
  }, [hasRunnableShots, onExecuteAllShots, queueRunning, shots]);

  const handleSyncResults = useCallback(() => {
    const synced = onSyncShotResults?.() ?? 0;
    if (synced > 0) {
      toast.success(`已同步 ${synced} 个分镜结果`);
    } else {
      toast.info('当前画布还没有可同步的分镜结果');
    }
  }, [onSyncShotResults]);

  const handleClearShots = useCallback(() => {
    clearShots();
    clearVersions();
  }, [clearShots, clearVersions]);

  const handleExportStoryboard = useCallback(() => {
    if (shots.length === 0) {
      toast.info('请先生成镜头');
      return;
    }

    downloadStoryboardExport(exportDocument);
    toast.success('已导出分镜成片清单');
  }, [exportDocument, shots.length]);

  const handleSendToClipEditor = useCallback(() => {
    if (shots.length === 0) {
      toast.info('请先生成镜头');
      return;
    }

    const items = buildClipItemsFromStoryboardExport(exportDocument);
    if (items.length === 0) {
      toast.info('还没有可交付素材，请先执行或同步分镜结果');
      return;
    }

    sendCanvasMediaToClipEditor(items, 'storyboard-panel');
    const missing = exportDocument.summary.missingAssetCount;
    toast.success(`正在打开 AI剪辑，交付 ${items.length} 个镜头${missing > 0 ? `，${missing} 个待生成` : ''}`);
  }, [exportDocument, shots.length]);

  if (!isOpen) return null;

  return (
    <section className="fixed right-4 top-20 z-[9996] flex h-[calc(100vh-120px)] w-[380px] flex-col rounded-2xl border border-white/[0.09] bg-[#101014]/96 shadow-2xl backdrop-blur-2xl">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200">
            <Clapperboard className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">分镜导演</h2>
            <p className="text-[10px] text-white/38">{shots.length} 个镜头 · 剧本到画布</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-white/38 hover:bg-white/10 hover:text-white"
          aria-label="关闭分镜导演"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="border-b border-white/[0.06] p-3">
        <textarea
          value={scriptDraft}
          onChange={(event) => setScriptDraft(event.target.value)}
          placeholder="粘贴剧本、分场或口播文案..."
          className="h-28 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] leading-5 text-white/78 outline-none placeholder:text-white/25 focus:border-violet-400/45"
        />
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
          <button
            type="button"
            onClick={handleGenerate}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-white text-[#111] px-3 py-2 text-[11px] font-semibold hover:bg-white/90"
          >
            <Wand2 className="h-3.5 w-3.5" />
            拆成镜头
          </button>
          <button
            type="button"
            onClick={handleClearShots}
            className="rounded-lg bg-white/[0.05] px-2.5 py-2 text-white/45 hover:bg-red-500/12 hover:text-red-200"
            title="清空镜头"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={handleCreateAll}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-violet-500/18 px-3 py-2 text-[11px] font-medium text-violet-100 hover:bg-violet-500/28"
          >
            <Workflow className="h-3.5 w-3.5" />
            建组
          </button>
          <button
            type="button"
            onClick={handleExecuteAll}
            disabled={!hasRunnableShots || !onExecuteAllShots || queueRunning}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/18 px-3 py-2 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/28 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/28"
          >
            <Play className="h-3.5 w-3.5" />
            执行
          </button>
          <button
            type="button"
            onClick={handleSyncResults}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-[11px] font-medium text-white/65 hover:bg-white/[0.1] hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            同步
          </button>
        </div>
        {shots.length > 0 && (
          <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.035] p-2">
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div>
                <p className="text-[12px] font-semibold text-white/82">{exportDocument.summary.shotCount}</p>
                <p className="text-[9px] text-white/32">镜头</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-sky-200">{exportDocument.summary.videoReadyCount}</p>
                <p className="text-[9px] text-white/32">视频</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-emerald-200">{exportDocument.summary.imageReadyCount}</p>
                <p className="text-[9px] text-white/32">图片</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-amber-200">{exportDocument.summary.totalDuration}s</p>
                <p className="text-[9px] text-white/32">时长</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportStoryboard}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[10px] font-medium text-white/68 hover:bg-white/[0.1] hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              导出成片清单 JSON
            </button>
            <button
              type="button"
              onClick={handleSendToClipEditor}
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-500/16 px-3 py-1.5 text-[10px] font-medium text-sky-100 hover:bg-sky-500/26"
            >
              <Scissors className="h-3.5 w-3.5" />
              交付 AI剪辑时间线
            </button>
          </div>
        )}
        <ShotExecutionQueuePanel />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3 custom-scrollbar">
        {shots.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-8 text-center">
            <Clapperboard className="mb-3 h-8 w-8 text-white/18" />
            <p className="text-[12px] font-medium text-white/62">还没有镜头</p>
            <p className="mt-1 text-[10px] leading-4 text-white/32">输入剧本后拆镜，会生成可编辑的镜头卡片，并可一键创建画布节点组。</p>
          </div>
        ) : (
          shots.map((shot, index) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              selected={selectedShotId === shot.id}
              onSelect={() => selectShot(shot.id)}
              onUpdate={(patch) => updateShot(shot.id, patch)}
              onDelete={() => removeShot(shot.id)}
              onCreateNodes={() => onCreateShotNodes(shot)}
              onExecute={() => onExecuteShot?.(shot)}
              executionDisabled={queueRunning}
              onFocusNodes={() => onFocusShotNodes?.(shot)}
              onMoveUp={() => moveShot(shot.id, 'up')}
              onMoveDown={() => moveShot(shot.id, 'down')}
              canMoveUp={index > 0}
              canMoveDown={index < shots.length - 1}
              onSelectVersion={(mediaType, versionId) => selectShotVersion(shot.id, mediaType, versionId)}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default memo(StoryboardPanel);
