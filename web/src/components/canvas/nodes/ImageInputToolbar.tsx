import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Columns2,
  Download,
  FlipHorizontal2,
  Grid3X3,
  Layers,
  LayoutGrid,
  Lightbulb,
  Maximize2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  autoMattingToImageInputNode,
  spawnGridSplitter,
  spawnImageInputToolNode,
  spawnUpscaleStudio,
} from '@/services/image-input-toolbar-service';

interface ImageInputToolbarProps {
  nodeId: string;
  hasImage: boolean;
  onDownload: () => void;
  onExpand: () => void;
  onCompareToggle: () => void;
  compareActive: boolean;
  canCompare: boolean;
  onFlip: () => void;
}

interface ToolbarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  tooltip?: string;
  disabled?: boolean;
  dropdown?: { id: string; label: string; action: () => void; separator?: boolean }[];
  action?: () => void;
}

function ToolbarButton({
  item,
  openMenuId,
  setOpenMenuId,
}: {
  item: ToolbarItem;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const isOpen = openMenuId === item.id;
  const disabled = Boolean(item.disabled);

  useEffect(() => {
    if (!isOpen) return;
    const updateMenuPosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({ left: rect.left, top: rect.bottom + 8 });
    };
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpenMenuId(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    updateMenuPosition();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [isOpen, setOpenMenuId]);

  return (
    <div className="group relative flex shrink-0 flex-col items-center">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (item.dropdown?.length) {
            setOpenMenuId(isOpen ? null : item.id);
            return;
          }
          item.action?.();
        }}
        className={cn(
          'relative flex h-8 min-w-[52px] items-center justify-center gap-1 rounded-[10px] px-2 text-[11px] font-medium transition-colors',
          disabled
            ? 'cursor-not-allowed text-white/20'
            : 'text-white/72 hover:bg-white/[0.08] hover:text-white',
          isOpen && 'bg-white/10 text-white'
        )}
      >
        {item.icon}
        <span className="whitespace-nowrap">{item.label}</span>
        {item.dropdown?.length ? <ChevronDown className="h-3 w-3 opacity-60" /> : null}
        {item.badge ? (
          <span className="ml-0.5 rounded-md border border-white/12 bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold leading-none text-white/72">
            {item.badge}
          </span>
        ) : null}
      </button>

      {item.tooltip ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-full z-[70] mt-2 -translate-x-1/2 whitespace-nowrap rounded-[5px] bg-black px-2 py-1 text-[12px] text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100"
        >
          {item.tooltip}
        </div>
      ) : null}

      {isOpen && item.dropdown?.length
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[9999] max-h-[360px] min-w-[180px] overflow-y-auto rounded-[10px] border border-white/12 bg-[#101012] py-2 shadow-[0_18px_42px_rgba(0,0,0,0.5)] custom-scrollbar"
              style={{ left: menuPosition.left, top: menuPosition.top }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {item.dropdown.map((opt) => (
                <div key={opt.id}>
                  {opt.separator ? <div className="mx-3 my-1 h-px bg-white/10" /> : null}
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] font-medium text-white/82 transition-colors hover:bg-white/[0.08] hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(null);
                      opt.action();
                    }}
                  >
                    <Layers className="h-4 w-4 shrink-0 text-white/55" strokeWidth={1.65} />
                    <span className="whitespace-nowrap">{opt.label}</span>
                  </button>
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function ImageInputToolbar({
  nodeId,
  hasImage,
  onDownload,
  onExpand,
  onCompareToggle,
  compareActive,
  canCompare,
  onFlip,
}: ImageInputToolbarProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const spawn = useCallback(
    (type: string, opts?: Parameters<typeof spawnImageInputToolNode>[2]) => {
      const newNodeId = spawnImageInputToolNode(nodeId, type, opts);
      setOpenMenuId(null);
      return newNodeId;
    },
    [nodeId]
  );

  const runAutoMatting = useCallback(() => {
    setOpenMenuId(null);
    void autoMattingToImageInputNode(nodeId).catch((error) => {
      console.error('[ImageInputToolbar] 自动抠图失败:', error);
      toast.error(`智能抠图失败：${(error as Error).message || '执行异常'}`);
    });
  }, [nodeId]);

  const runAicgNineGrid = useCallback(() => {
    setOpenMenuId(null);
    spawn('gridDirector', {
      label: 'AI九宫格',
      targetHandle: 'imageInput',
      initialData: {
        modelLabel: '小天4 / 豆包 Seedream 5.0 Pro',
        lockDefaultModel: true,
        autoExecute: true,
        executeRequestedAt: Date.now(),
        params: {
          mode: 'grid',
          preset: 'character_turnaround',
          layout: '3x3',
          rows: 3,
          cols: 3,
          modelId: 'doubao-seedream-5-0-pro',
          modelProvider: 'doubao',
          modelLabel: '小天4 / 豆包 Seedream 5.0 Pro',
          quality: 'hd',
          aspectRatio: '1:1',
          prompt:
            '使用参考图片作为唯一主体与风格来源，调用豆包 Seedream 5.0 Pro 生成九宫格参考图。保持主体身份、服装、材质、色彩和画风一致，输出正面、左前45度、右前45度、左侧、右侧、背面、俯拍、仰拍、细节特写九个视角，组成一张完整九宫格参考图。',
          negativePrompt: '主体不一致, 服装变化, 脸部变化, 风格漂移, 低清, 模糊, 畸形, 文字错误',
          generateSingleFrames: true,
          composeGridImage: true,
          fallbackToReference: true,
          characterLock: true,
          outfitLock: true,
          environmentLock: true,
          consistencyStrength: 0.95,
        },
      },
    });
  }, [spawn]);

  const primaryItems = useMemo<ToolbarItem[]>(
    () => [
      {
        id: 'panorama',
        label: '全景',
        badge: 'NEW',
        icon: <span className="text-[16px] leading-none">㊄</span>,
        disabled: !hasImage,
        action: () => spawn('panorama360', { label: '360° 全景图', targetHandle: 'input' }),
      },
      {
        id: 'multiAngle',
        label: '多角度',
        icon: <span className="text-[13px] leading-none">◈</span>,
        disabled: !hasImage,
        action: () => spawn('multiAngle', { label: '多角度', targetHandle: 'input' }),
      },
      {
        id: 'light',
        label: '打光',
        icon: <Lightbulb className="h-4 w-4" strokeWidth={1.75} />,
        disabled: !hasImage,
        action: () =>
          spawn('aiImage', {
            label: '打光重绘',
            targetHandle: 'input',
            initialData: {
              params: { mode: 'generate' },
              localPrompt: '专业摄影棚三点布光，柔和主光，轮廓光，电影级光影',
            },
          }),
      },
      {
        id: 'grid',
        label: '九宫格',
        icon: <Grid3X3 className="h-4 w-4" />,
        disabled: !hasImage,
        action: runAicgNineGrid,
      },
      {
        id: 'hd',
        label: '高清',
        icon: (
          <span className="rounded-[5px] border border-white/25 px-1.5 text-[10px] font-bold leading-5">
            HD
          </span>
        ),
        disabled: !hasImage,
        dropdown: [
          { id: '2x', label: '2× 高清', action: () => spawnUpscaleStudio(nodeId, 2) },
          { id: '4x', label: '4× 高清', action: () => spawnUpscaleStudio(nodeId, 4) },
          {
            id: 'repaint',
            label: '重绘',
            action: () =>
              spawn('aiImage', {
                label: '高清重绘',
                targetHandle: 'input',
                initialData: { params: { mode: 'generate' } },
              }),
          },
          {
            id: 'erase',
            label: '擦除',
            action: () =>
              spawn('aiImage', {
                label: '局部擦除',
                targetHandle: 'input',
                initialData: { params: { mode: 'inpaint' } },
              }),
          },
          {
            id: 'matting',
            label: '抠图',
            action: runAutoMatting,
          },
          {
            id: 'crop',
            label: '裁剪',
            action: () => spawn('aiImage', { label: '裁剪编辑', targetHandle: 'input' }),
          },
        ],
      },
      {
        id: 'split',
        label: '宫格切分',
        icon: <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.75} />,
        disabled: !hasImage,
        action: () => {
          const splitNodeId = spawnGridSplitter(nodeId, 3, 3, '宫格 3×3');
          if (splitNodeId) {
            window.setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent('split-grid-node', { detail: { nodeId: splitNodeId } })
              );
            }, 650);
          }
        },
      },
    ],
    [hasImage, nodeId, runAicgNineGrid, runAutoMatting, spawn]
  );

  const utilityItems = useMemo<ToolbarItem[]>(
    () => [
      {
        id: 'matting',
        label: '抠图',
        icon: <Wand2 className="h-4 w-4" strokeWidth={1.75} />,
        disabled: !hasImage,
        action: () => {
          void autoMattingToImageInputNode(nodeId).catch((error) => {
            console.error('[ImageInputToolbar] 自动抠图失败:', error);
            toast.error(`智能抠图失败：${(error as Error).message || '执行异常'}`);
          });
        },
      },
      {
        id: 'download',
        label: '下载',
        icon: <Download className="h-[18px] w-[18px]" strokeWidth={1.75} />,
        disabled: !hasImage,
        action: onDownload,
      },
      {
        id: 'expand',
        label: '放大',
        icon: <Maximize2 className="h-4 w-4" strokeWidth={1.75} />,
        disabled: !hasImage,
        action: onExpand,
      },
      {
        id: 'flip',
        label: '镜像',
        icon: <FlipHorizontal2 className="h-3.5 w-3.5" strokeWidth={1.75} />,
        disabled: !hasImage,
        action: onFlip,
      },
      {
        id: 'compare',
        label: compareActive ? '对比中' : '对比',
        icon: <Columns2 className="h-4 w-4" strokeWidth={1.75} />,
        disabled: !canCompare,
        action: onCompareToggle,
      },
    ],
    [canCompare, compareActive, hasImage, nodeId, onCompareToggle, onDownload, onExpand, onFlip]
  );

  return (
    <div
      className="nodrag nowheel flex w-full flex-nowrap items-center gap-1 rounded-[14px] border border-white/14 bg-[#101012] px-2.5 py-2 shadow-[0_18px_44px_rgba(0,0,0,0.48)]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex shrink-0 flex-nowrap items-center gap-1 overflow-visible pr-1">
        {primaryItems.map((item) => (
          <ToolbarButton
            key={item.id}
            item={item}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
          />
        ))}
      </div>

      <div className="hidden h-8 w-px shrink-0 bg-white/10 sm:block" />

      <div className="flex shrink-0 flex-nowrap items-center gap-1">
        {utilityItems.map((item) => (
          <ToolbarButton
            key={item.id}
            item={item}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
          />
        ))}
      </div>

      {!hasImage ? (
        <span className="ml-1.5 flex shrink-0 items-center gap-1 pr-1 text-[10px] text-white/35">
          <Sparkles className="h-3.5 w-3.5" />
          上传后可用
        </span>
      ) : null}
    </div>
  );
}

export default memo(ImageInputToolbar);
