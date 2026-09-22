import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  useAdvancedEffectsStore,
  advancedEffectsService,
  type MaskShape,
  type MaskMode,
  type Mask,
} from '@/services/advanced-effects-service';
import {
  Square,
  Circle,
  Pentagon,
  Pencil,
  Wand2,
  VolumeX,
  Palette,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  RotateCcw,
  Sliders,
  Layers,
  Plus,
  Minus,
  GitMerge,
  Replace,
} from 'lucide-react';

interface AdvancedEffectsPanelProps {
  clipId: string;
  className?: string;
}

const MASK_SHAPE_ICONS: Record<MaskShape, React.ReactNode> = {
  rectangle: <Square className="w-4 h-4" />,
  ellipse: <Circle className="w-4 h-4" />,
  polygon: <Pentagon className="w-4 h-4" />,
  bezier: <Pencil className="w-4 h-4" />,
  freehand: <Pencil className="w-4 h-4" />,
  magic: <Wand2 className="w-4 h-4" />,
};

const MASK_MODE_ICONS: Record<MaskMode, React.ReactNode> = {
  add: <Plus className="w-4 h-4" />,
  subtract: <Minus className="w-4 h-4" />,
  intersect: <GitMerge className="w-4 h-4" />,
  replace: <Replace className="w-4 h-4" />,
};

export const AdvancedEffectsPanel: React.FC<AdvancedEffectsPanelProps> = ({
  clipId,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<'mask' | 'denoise' | 'lut'>('mask');
  const [selectedShape, setSelectedShape] = useState<MaskShape>('rectangle');
  const [selectedMode, setSelectedMode] = useState<MaskMode>('add');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    masks,
    luts,
    appliedLUTs,
    noiseReduction,
    selectedMaskId,
    addMask,
    removeMask,
    updateMask,
    toggleMask,
    setSelectedMask,
    applyLUT,
    removeAppliedLUT,
    updateLUTIntensity,
    addLUT,
    setNoiseReduction,
    getMasksForClip,
    getAppliedLUTForClip,
    getNoiseReductionForClip,
  } = useAdvancedEffectsStore();

  const clipMasks = getMasksForClip(clipId);
  const appliedLUT = getAppliedLUTForClip(clipId);
  const clipNoiseReduction = getNoiseReductionForClip(clipId);

  const handleAddMask = () => {
    addMask(clipId, selectedShape);
  };

  const handleLUTUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.name.endsWith('.cube') || file.name.endsWith('.3dl') || file.name.endsWith('.m3d')) {
        try {
          const lut = await advancedEffectsService.loadLUTFile(file);
          addLUT(lut);
        } catch (error) {
          console.error('Failed to load LUT:', error);
        }
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const tabs = [
    { id: 'mask' as const, label: '遮罩', icon: Layers },
    { id: 'denoise' as const, label: '降噪', icon: VolumeX },
    { id: 'lut' as const, label: 'LUT调色', icon: Palette },
  ];

  return (
    <div className={cn('flex flex-col bg-[#0D0D0D] rounded-lg overflow-hidden', className)}>
      <div className="flex items-center justify-between px-3 py-2 bg-[#1A1A1A] border-b border-[#2D2D2D]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">高级效果</span>
        </div>
      </div>

      <div className="flex gap-1 px-3 py-2 bg-[#1A1A1A] border-b border-[#2D2D2D]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-colors',
                isActive
                  ? 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                  : 'bg-[#1F1F1F] text-gray-400 hover:bg-[#2D2D2D]'
              )}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'mask' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-300">遮罩形状</label>
              <div className="flex flex-wrap gap-2">
                {advancedEffectsService.getMaskShapes().map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => setSelectedShape(shape.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1.5 text-xs rounded border transition-colors',
                      selectedShape === shape.id
                        ? 'bg-gray-500/20 border-gray-500/50 text-gray-400'
                        : 'bg-[#1F1F1F] border-[#3A3A3A] text-gray-400 hover:border-[#4A4A4A]'
                    )}
                  >
                    {MASK_SHAPE_ICONS[shape.id]}
                    {shape.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300">遮罩模式</label>
              <div className="flex flex-wrap gap-2">
                {advancedEffectsService.getMaskModes().map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1.5 text-xs rounded border transition-colors',
                      selectedMode === mode.id
                        ? 'bg-gray-500/20 border-gray-500/50 text-gray-400'
                        : 'bg-[#1F1F1F] border-[#3A3A3A] text-gray-400 hover:border-[#4A4A4A]'
                    )}
                  >
                    {MASK_MODE_ICONS[mode.id]}
                    {mode.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAddMask}
              className="w-full py-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              添加遮罩
            </button>

            <div className="space-y-2">
              <label className="text-sm text-gray-300">已添加遮罩 ({clipMasks.length})</label>
              {clipMasks.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-4">
                  暂无遮罩
                </div>
              ) : (
                <div className="space-y-1">
                  {clipMasks.map((mask) => (
                    <div
                      key={mask.id}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                        selectedMaskId === mask.id
                          ? 'bg-gray-500/20 border border-gray-500/50'
                          : 'bg-[#1F1F1F] hover:bg-[#2D2D2D]'
                      )}
                      onClick={() => setSelectedMask(mask.id)}
                    >
                      {MASK_SHAPE_ICONS[mask.shape]}
                      <span className="flex-1 text-sm text-gray-300">{mask.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMask(mask.id);
                        }}
                        className="p-1 hover:bg-[#3A3A3A] rounded"
                      >
                        {mask.enabled ? (
                          <Eye className="w-4 h-4 text-green-400" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMask(mask.id);
                        }}
                        className="p-1 hover:bg-[#3A3A3A] rounded text-gray-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedMaskId && (
              <div className="space-y-3 border-t border-[#2D2D2D] pt-3">
                <div className="text-sm text-gray-300">遮罩属性</div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-400">羽化</label>
                    <span className="text-xs text-gray-500">{clipMasks.find((m) => m.id === selectedMaskId)?.feather || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={clipMasks.find((m) => m.id === selectedMaskId)?.feather || 0}
                    onChange={(e) => updateMask(selectedMaskId, { feather: Number(e.target.value) })}
                    className="w-full h-1 accent-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-400">扩展</label>
                    <span className="text-xs text-gray-500">{clipMasks.find((m) => m.id === selectedMaskId)?.expansion || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={clipMasks.find((m) => m.id === selectedMaskId)?.expansion || 0}
                    onChange={(e) => updateMask(selectedMaskId, { expansion: Number(e.target.value) })}
                    className="w-full h-1 accent-gray-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">反转遮罩</label>
                  <button
                    onClick={() => {
                      const mask = clipMasks.find((m) => m.id === selectedMaskId);
                      if (mask) {
                        updateMask(selectedMaskId, { inverted: !mask.inverted });
                      }
                    }}
                    className={cn(
                      'w-10 h-5 rounded-full transition-colors',
                      clipMasks.find((m) => m.id === selectedMaskId)?.inverted
                        ? 'bg-gray-500'
                        : 'bg-[#3A3A3A]'
                    )}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 bg-white rounded-full transition-transform',
                        clipMasks.find((m) => m.id === selectedMaskId)?.inverted
                          ? 'translate-x-5'
                          : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'denoise' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">启用降噪</label>
              <button
                onClick={() => setNoiseReduction(clipId, { enabled: !clipNoiseReduction.enabled })}
                className={cn(
                  'w-10 h-5 rounded-full transition-colors',
                  clipNoiseReduction.enabled ? 'bg-green-500' : 'bg-[#3A3A3A]'
                )}
              >
                <div
                  className={cn(
                    'w-4 h-4 bg-white rounded-full transition-transform',
                    clipNoiseReduction.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {clipNoiseReduction.enabled && (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">降噪模式</label>
                  <div className="flex gap-2">
                    {(['spatial', 'temporal', 'both'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setNoiseReduction(clipId, { denoiseMode: mode })}
                        className={cn(
                          'flex-1 py-1.5 text-xs rounded transition-colors',
                          clipNoiseReduction.denoiseMode === mode
                            ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                            : 'bg-[#1F1F1F] text-gray-400 hover:bg-[#2D2D2D]'
                        )}
                      >
                        {mode === 'spatial' ? '空间' : mode === 'temporal' ? '时间' : '混合'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-400">降噪强度</label>
                    <span className="text-xs text-gray-500">{clipNoiseReduction.strength}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={clipNoiseReduction.strength}
                    onChange={(e) => setNoiseReduction(clipId, { strength: Number(e.target.value) })}
                    className="w-full h-1 accent-green-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-400">保留细节</label>
                    <span className="text-xs text-gray-500">{clipNoiseReduction.preserveDetails}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={clipNoiseReduction.preserveDetails}
                    onChange={(e) => setNoiseReduction(clipId, { preserveDetails: Number(e.target.value) })}
                    className="w-full h-1 accent-green-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-400">空间滤波强度</label>
                    <span className="text-xs text-gray-500">{clipNoiseReduction.spatialFilter}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={clipNoiseReduction.spatialFilter}
                    onChange={(e) => setNoiseReduction(clipId, { spatialFilter: Number(e.target.value) })}
                    className="w-full h-1 accent-green-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-400">时间滤波强度</label>
                    <span className="text-xs text-gray-500">{clipNoiseReduction.temporalFilter}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={clipNoiseReduction.temporalFilter}
                    onChange={(e) => setNoiseReduction(clipId, { temporalFilter: Number(e.target.value) })}
                    className="w-full h-1 accent-green-500"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'lut' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">LUT预设</label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-[#1F1F1F] hover:bg-[#2D2D2D] rounded text-gray-400 transition-colors"
              >
                <Upload className="w-3 h-3" />
                导入LUT
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".cube,.3dl,.m3d"
                onChange={handleLUTUpload}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {luts.map((lut) => (
                <button
                  key={lut.id}
                  onClick={() => applyLUT(clipId, lut.id, 100)}
                  className={cn(
                    'p-2 rounded-lg text-left transition-colors',
                    appliedLUT?.lutId === lut.id
                      ? 'bg-pink-500/20 border border-pink-500/50'
                      : 'bg-[#1F1F1F] hover:bg-[#2D2D2D] border border-transparent'
                  )}
                >
                  <div className="text-sm text-gray-200">{lut.name}</div>
                  <div className="text-xs text-gray-500">{lut.category}</div>
                  {lut.isPremium && (
                    <div className="text-xs text-yellow-400 mt-1">VIP</div>
                  )}
                </button>
              ))}
            </div>

            {appliedLUT && (
              <div className="space-y-3 border-t border-[#2D2D2D] pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-300">
                    已应用: {luts.find((l) => l.id === appliedLUT.lutId)?.name}
                  </label>
                  <button
                    onClick={() => removeAppliedLUT(clipId)}
                    className="p-1 hover:bg-[#2D2D2D] rounded text-gray-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-400">强度</label>
                    <span className="text-xs text-gray-500">{appliedLUT.intensity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={appliedLUT.intensity}
                    onChange={(e) => updateLUTIntensity(clipId, Number(e.target.value))}
                    className="w-full h-1 accent-pink-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedEffectsPanel;
