/**
 * 角色一致性节点
 * 角色特征提取与跨镜头一致性保持
 */

import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { NodeProps, useStore } from '@xyflow/react';
import {
  Upload,
  Download,
  Loader2,
  Wand2,
  Users,
  Image,
  Zap,
  Brain,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getSafeRenderableMediaUrl } from '@/lib/media-url';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import { aicgGlass } from './aicg-node-glass';
import { canvasStoreApi } from '@/store/useCanvasStore';
import {
  getCharacterAssetPayloadFromNodeData,
  resolveCharacterReferenceFromNodeData,
} from './character-payload';
import { parseStoryboardPayload, resolveStoryboardSelection } from './storyboard-payload';
import { backendProxyAdapter } from '@/services/adapters/backend-proxy-adapter';
import {
  spawnControllerToolNode,
} from '@/services/node-controller-action-service';

interface CharacterConsistencyNodeData {
  characterImageUrl?: string;
  targetImageUrl?: string;
  characterName?: string;
  consistencyStrength?: number;
  faceEnhance?: boolean;
  resultUrl?: string;
  task?: {
    status: 'idle' | 'processing' | 'done' | 'error';
    progress?: number;
    resultUrl?: string;
  };
  inputMode?: 'single' | 'storyboard-selected' | 'storyboard-sequence';
  storyboardFrames?: Array<Record<string, unknown>>;
  selectedFrame?: Record<string, unknown> | null;
  resultFrames?: Array<Record<string, unknown>>;
}

const CharacterConsistencyNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = data as any as CharacterConsistencyNodeData;
  const updateNodeData = canvasStoreApi.updateNodeData;

  // 从 store 获取连接信息
  const edges = useStore((s) => s.edges);
  const nodes = useStore((s) => s.nodes);

  // 获取连接的角色图片源
  const connectedCharacterUrl = useMemo(() => {
    const edge = edges.find((e) => e.target === id && e.targetHandle === 'characterImage');
    if (!edge) return null;
    const src = nodes.find((n) => n.id === edge.source);
    if (!src) return null;
    const sd = src.data as Record<string, unknown>;
    return (
      resolveCharacterReferenceFromNodeData(sd, edge.sourceHandle) ||
      (sd?.output as string) ||
      (sd?.url as string) ||
      ((sd?.task as Record<string, unknown>)?.resultUrl as string) ||
      null
    );
  }, [edges, nodes, id]);
  const connectedCharacterPayload = useMemo(() => {
    const edge = edges.find((e) => e.target === id && e.targetHandle === 'characterImage');
    if (!edge) return null;
    const src = nodes.find((n) => n.id === edge.source);
    if (!src) return null;
    return getCharacterAssetPayloadFromNodeData((src.data || {}) as Record<string, unknown>);
  }, [edges, nodes, id]);

  // 获取连接的目标图片源
  const connectedTargetUrl = useMemo(() => {
    const edge = edges.find((e) => e.target === id && e.targetHandle === 'targetImage');
    if (!edge) return null;
    const src = nodes.find((n) => n.id === edge.source);
    if (!src) return null;
    const sd = src.data as Record<string, unknown>;
    return (
      resolveCharacterReferenceFromNodeData(sd, edge.sourceHandle) ||
      (sd?.imageUrl as string) ||
      (sd?.output as string) ||
      (sd?.url as string) ||
      ((sd?.task as Record<string, unknown>)?.resultUrl as string) ||
      null
    );
  }, [edges, nodes, id]);
  const connectedTargetStoryboard = useMemo(() => {
    const edge = edges.find((e) => e.target === id && e.targetHandle === 'targetImage');
    if (!edge) return null;
    const src = nodes.find((n) => n.id === edge.source);
    if (!src) return null;
    const sd = src.data as Record<string, unknown>;
    return parseStoryboardPayload(sd?.storyboardPayload);
  }, [edges, nodes, id]);

  const [characterImageUrl, setCharacterImageUrl] = useState(nodeData.characterImageUrl || '');
  const [targetImageUrl, setTargetImageUrl] = useState(nodeData.targetImageUrl || '');
  const [characterName, setCharacterName] = useState(nodeData.characterName || '');
  const [consistencyStrength, setConsistencyStrength] = useState(nodeData.consistencyStrength ?? 0.85);
  const [faceEnhance, setFaceEnhance] = useState(nodeData.faceEnhance ?? true);
  const [processingMode, setProcessingMode] = useState<'quick' | 'ai'>('quick');
  const [resultUrl, setResultUrl] = useState(nodeData.resultUrl || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [characterRefUrl, setCharacterRefUrl] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSyncedData = useRef<string>('');
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const revokeAllBlobUrls = useCallback(() => {
    blobUrlsRef.current.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Blob URL may already be revoked by the browser.
      }
    });
    blobUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      revokeAllBlobUrls();
    };
  }, [revokeAllBlobUrls]);

  const resolvedStoryboardTarget = useMemo(
    () => (connectedTargetStoryboard ? resolveStoryboardSelection(connectedTargetStoryboard) : null),
    [connectedTargetStoryboard],
  );

  // 同步数据到 store
  useEffect(() => {
    const currentData = {
      characterImageUrl,
      targetImageUrl,
      characterName,
      consistencyStrength,
      faceEnhance,
      processingMode,
      resultUrl,
      characterRefUrl,
      characterRef: characterRefUrl,
      params: {
        consistencyStrength,
        faceEnhance,
        characterName,
        processingMode,
      },
    };
    const dataString = JSON.stringify(currentData);

    // 只有当本地状态与上次同步的数据不同时，才更新 store
    if (dataString !== lastSyncedData.current) {
      lastSyncedData.current = dataString;
      updateNodeData(id as string, currentData);
    }
  }, [characterImageUrl, targetImageUrl, characterName, consistencyStrength, faceEnhance, processingMode, resultUrl, characterRefUrl, id, updateNodeData]);

  // 监听输入连接
  useEffect(() => {
    if (connectedCharacterUrl && connectedCharacterUrl !== characterImageUrl) {
      setCharacterImageUrl(connectedCharacterUrl);
    }
  }, [connectedCharacterUrl, characterImageUrl]);

  useEffect(() => {
    if (connectedCharacterPayload?.name && connectedCharacterPayload.name !== characterName) {
      setCharacterName(connectedCharacterPayload.name);
    }
  }, [characterName, connectedCharacterPayload]);

  useEffect(() => {
    if (resolvedStoryboardTarget) {
      if (resolvedStoryboardTarget.mode === 'sequence') {
        updateNodeData(id as string, {
          inputMode: 'storyboard-sequence',
          storyboardFrames: resolvedStoryboardTarget.sequenceFrames,
          selectedFrame: null,
        });
        if (resolvedStoryboardTarget.sequenceFrames[0]?.imageUrl) {
          setTargetImageUrl(resolvedStoryboardTarget.sequenceFrames[0].imageUrl);
        }
        return;
      }

      updateNodeData(id as string, {
        inputMode: 'storyboard-selected',
        storyboardFrames: [],
        selectedFrame: resolvedStoryboardTarget.selectedFrame,
      });
      if (resolvedStoryboardTarget.selectedFrame?.imageUrl) {
        setTargetImageUrl(resolvedStoryboardTarget.selectedFrame.imageUrl);
      }
      return;
    }

    if (connectedTargetUrl && connectedTargetUrl !== targetImageUrl) {
      setTargetImageUrl(connectedTargetUrl);
    }
  }, [connectedTargetUrl, id, resolvedStoryboardTarget, targetImageUrl, updateNodeData]);

  const loadImage = useCallback((url: string, controller?: AbortController) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new globalThis.Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        if (controller?.signal.aborted) {
          reject(new DOMException('aborted', 'AbortError'));
          return;
        }
        resolve(image);
      };
      image.onerror = () => reject(new Error('图片加载失败'));
      image.src = url;
    });
  }, []);

  const buildCharacterConsistencyResult = useCallback(
    async (
      characterImg: HTMLImageElement,
      targetImg: HTMLImageElement | null,
      strength: number,
      enableFaceEnhance: boolean,
    ) => {
      const canvas = document.createElement('canvas');
      const sourceImg = targetImg || characterImg;
      canvas.width = sourceImg.naturalWidth;
      canvas.height = sourceImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('无法创建画布上下文');
      }

      ctx.drawImage(targetImg || characterImg, 0, 0);

      const charCanvas = document.createElement('canvas');
      charCanvas.width = characterImg.naturalWidth;
      charCanvas.height = characterImg.naturalHeight;
      const charCtx = charCanvas.getContext('2d');
      if (!charCtx) {
        throw new Error('无法创建角色画布');
      }
      charCtx.drawImage(characterImg, 0, 0);
      const charData = charCtx.getImageData(0, 0, charCanvas.width, charCanvas.height);

      let charR = 0;
      let charG = 0;
      let charB = 0;
      const charTotal = charData.data.length / 4;
      if (charTotal === 0) {
        throw new Error('角色图片像素数据为空');
      }
      for (let i = 0; i < charData.data.length; i += 4) {
        charR += charData.data[i];
        charG += charData.data[i + 1];
        charB += charData.data[i + 2];
      }
      charR /= charTotal;
      charG /= charTotal;
      charB /= charTotal;

      const targetData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      let targetR = 0;
      let targetG = 0;
      let targetB = 0;
      const targetTotal = targetData.data.length / 4;
      if (targetTotal === 0) {
        throw new Error('目标图片像素数据为空');
      }
      for (let i = 0; i < targetData.data.length; i += 4) {
        targetR += targetData.data[i];
        targetG += targetData.data[i + 1];
        targetB += targetData.data[i + 2];
      }
      targetR /= targetTotal;
      targetG /= targetTotal;
      targetB /= targetTotal;

      for (let i = 0; i < targetData.data.length; i += 4) {
        const r = targetData.data[i];
        const g = targetData.data[i + 1];
        const b = targetData.data[i + 2];
        const dr = r - targetR;
        const dg = g - targetG;
        const db = b - targetB;

        targetData.data[i] = Math.min(
          255,
          Math.max(0, charR + dr * (1 - strength * 0.5) + (charR - targetR) * strength),
        );
        targetData.data[i + 1] = Math.min(
          255,
          Math.max(0, charG + dg * (1 - strength * 0.5) + (charG - targetG) * strength),
        );
        targetData.data[i + 2] = Math.min(
          255,
          Math.max(0, charB + db * (1 - strength * 0.5) + (charB - targetB) * strength),
        );
      }

      ctx.putImageData(targetData, 0, 0);

      if (enableFaceEnhance && characterImg.naturalWidth > 100) {
        const faceW = Math.floor(charCanvas.width * 0.35);
        const faceH = Math.floor(charCanvas.height * 0.4);
        const faceX = Math.floor(charCanvas.width * 0.325);
        const faceY = Math.floor(charCanvas.height * 0.15);
        const faceRegion = charCtx.getImageData(faceX, faceY, faceW, faceH);

        let faceR = 0;
        let faceG = 0;
        let faceB = 0;
        const faceTotal = faceRegion.data.length / 4;
        if (faceTotal > 0) {
          for (let i = 0; i < faceRegion.data.length; i += 4) {
            faceR += faceRegion.data[i];
            faceG += faceRegion.data[i + 1];
            faceB += faceRegion.data[i + 2];
          }
          faceR /= faceTotal;
          faceG /= faceTotal;
          faceB /= faceTotal;
        }

        const tgtCenterX = Math.floor(canvas.width * 0.25);
        const tgtCenterY = Math.floor(canvas.height * 0.1);
        const tgtW = Math.floor(canvas.width * 0.5);
        const tgtH = Math.floor(canvas.height * 0.5);
        const tgtCenter = ctx.getImageData(tgtCenterX, tgtCenterY, tgtW, tgtH);

        for (let i = 0; i < tgtCenter.data.length; i += 4) {
          const brightness = (tgtCenter.data[i] + tgtCenter.data[i + 1] + tgtCenter.data[i + 2]) / 3;
          if (brightness > 40 && brightness < 220) {
            tgtCenter.data[i] = Math.min(255, tgtCenter.data[i] * 0.7 + faceR * 0.3 * strength);
            tgtCenter.data[i + 1] = Math.min(
              255,
              tgtCenter.data[i + 1] * 0.7 + faceG * 0.3 * strength,
            );
            tgtCenter.data[i + 2] = Math.min(
              255,
              tgtCenter.data[i + 2] * 0.7 + faceB * 0.3 * strength,
            );
          }
        }
        ctx.putImageData(tgtCenter, tgtCenterX, tgtCenterY);
      }

      const result = await new Promise<string>((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              blobUrlsRef.current.add(url);
              resolve(url);
            } else {
              resolve(canvas.toDataURL('image/png'));
            }
          },
          'image/png',
        );
      });

      const refCanvas = document.createElement('canvas');
      const refSize = 128;
      refCanvas.width = refSize;
      refCanvas.height = refSize;
      const refCtx = refCanvas.getContext('2d');
      let characterRef = '';
      if (refCtx) {
        const scale = Math.min(refSize / charCanvas.width, refSize / charCanvas.height);
        refCtx.drawImage(
          characterImg,
          0,
          0,
          charCanvas.width,
          charCanvas.height,
          (refSize - charCanvas.width * scale) / 2,
          (refSize - charCanvas.height * scale) / 2,
          charCanvas.width * scale,
          charCanvas.height * scale,
        );
        refCtx.strokeStyle = '#10B981';
        refCtx.lineWidth = 2;
        refCtx.strokeRect(2, 2, refSize - 4, refSize - 4);
        characterRef = await new Promise<string>((resolve) => {
          refCanvas.toBlob(
            (blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                blobUrlsRef.current.add(url);
                resolve(url);
              } else {
                resolve(refCanvas.toDataURL('image/png'));
              }
            },
            'image/png',
          );
        });
      }

      return {
        resultUrl: result,
        characterRefUrl: characterRef,
      };
    },
    [],
  );

  const handleImageChange = useCallback((type: 'character' | 'target') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jpg,.jpeg,.png,.gif,.webp,.bmp';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const url = evt.target?.result as string;
          if (type === 'character') {
            setCharacterImageUrl(url);
          } else {
            setTargetImageUrl(url);
          }
          toast.success('图片加载成功');
        };
        reader.readAsDataURL(file);
      } catch (error) {
        toast.error('图片加载失败');
      }
    };
    input.click();
  }, []);

  const handleAIConsistency = useCallback(async (
    characterImgUrl: string,
    targetImgUrl: string | null,
    strength: number,
    signal: AbortSignal,
  ) => {
    const result = await backendProxyAdapter.generateImage({
      prompt: '保持角色外观一致性，融合角色特征',
      referenceImage: characterImgUrl,
      referenceImages: targetImgUrl ? [characterImgUrl, targetImgUrl] : [characterImgUrl],
      generationMode: targetImgUrl ? 'image_to_image' : 'character_reference',
      resolution: '1024x1024',
      quality: strength >= 7 ? 'hd' : 'standard',
      strength,
      characterConsistency: strength,
      faceEnhance,
      characterName,
      processingMode,
    });

    if (signal.aborted) throw new DOMException('aborted', 'AbortError');

    const resultUrl =
      result.resultUrls?.[0] || result.resultUrl || result.url || result.output;
    if (!resultUrl) {
      throw new Error('AI 角色一致性处理失败：未返回结果图片');
    }

    return {
      resultUrl,
      characterRefUrl: characterImgUrl,
    };
  }, [faceEnhance, characterName, processingMode]);

  /**
   * 角色特征提取与融合 - Canvas图像处理
   * 使用像素级颜色匹配 + 人脸区域增强来保持角色一致性
   */
  const handleProcess = useCallback(async () => {
    if (!characterImageUrl) {
      toast.warning('请上传角色图片');
      return;
    }

    setIsProcessing(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    updateNodeData(id as string, {
      task: { status: 'processing', progress: 0 },
    });

    const modeLabel = processingMode === 'ai' ? 'AI模式' : '快速模式';
    toast.info(`角色一致性处理中（${modeLabel}）...`);

    try {
      const sequenceFrames =
        resolvedStoryboardTarget?.mode === 'sequence' ? resolvedStoryboardTarget.sequenceFrames : [];

      if (sequenceFrames.length > 0) {
        const results: Array<Record<string, unknown>> = [];
        let sharedCharacterRefUrl = '';

        for (let index = 0; index < sequenceFrames.length; index += 1) {
          if (controller.signal.aborted) return;
          const frame = sequenceFrames[index];
          if (!frame.imageUrl) continue;

          let processed: { resultUrl: string; characterRefUrl: string };

          if (processingMode === 'ai') {
            processed = await handleAIConsistency(characterImageUrl, frame.imageUrl as string, consistencyStrength, controller.signal);
          } else {
            const characterImg = await loadImage(characterImageUrl, controller);
            const frameImage = await loadImage(frame.imageUrl as string, controller);
            processed = await buildCharacterConsistencyResult(characterImg, frameImage, consistencyStrength, faceEnhance);
          }

          if (!sharedCharacterRefUrl && processed.characterRefUrl) {
            sharedCharacterRefUrl = processed.characterRefUrl;
            setCharacterRefUrl(processed.characterRefUrl);
          }

          results.push({
            ...frame,
            sourceImageUrl: frame.imageUrl,
            resultUrl: processed.resultUrl,
            status: 'succeeded',
          });

          updateNodeData(id as string, {
            task: {
              status: 'processing',
              progress: Math.round(((index + 1) / sequenceFrames.length) * 100),
            },
          });
        }

        const primaryResult = (results[0]?.resultUrl as string) || '';
        setResultUrl(primaryResult);
        updateNodeData(id as string, {
          resultFrames: results,
          resultUrl: primaryResult,
          characterRefUrl: sharedCharacterRefUrl,
          task: { status: 'done', progress: 100, resultUrl: primaryResult },
        });
        setIsProcessing(false);
        toast.success(`角色一致性批处理完成（${modeLabel}），成功 ${results.length} 张`);
        return;
      }

      let processed: { resultUrl: string; characterRefUrl: string };

      if (processingMode === 'ai') {
        processed = await handleAIConsistency(characterImageUrl, targetImageUrl || null, consistencyStrength, controller.signal);
      } else {
        const characterImg = await loadImage(characterImageUrl, controller);
        const targetImg = targetImageUrl ? await loadImage(targetImageUrl, controller) : null;
        processed = await buildCharacterConsistencyResult(characterImg, targetImg, consistencyStrength, faceEnhance);
      }

      setResultUrl(processed.resultUrl);
      setCharacterRefUrl(processed.characterRefUrl);
      updateNodeData(id as string, {
        task: { status: 'done', progress: 100, resultUrl: processed.resultUrl },
      });
      setIsProcessing(false);
      toast.success(`角色一致性处理完成（${modeLabel}）`);
    } catch (error) {
      if (controller.signal.aborted) return;
      updateNodeData(id as string, {
        task: { status: 'error', progress: 0 },
      });
      setIsProcessing(false);
      toast.error(error instanceof Error ? error.message : '角色一致性处理失败');
    }
  }, [
    buildCharacterConsistencyResult,
    handleAIConsistency,
    characterImageUrl,
    targetImageUrl,
    consistencyStrength,
    faceEnhance,
    processingMode,
    id,
    loadImage,
    resolvedStoryboardTarget,
    updateNodeData,
  ]);

  const handleDownload = useCallback(() => {
    if (!resultUrl) return;

    const link = document.createElement('a');
    link.href = resultUrl;
    link.download = `character-consistent-${Date.now()}.png`;
    link.click();
  }, [resultUrl]);

  const handleDelete = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    canvasStoreApi.deleteNode(id as string);
  }, [id]);

  const runConsistencyDownstreamAction = useCallback(
    (actionId: string, replaceExisting = false) => {
      if (!resultUrl) {
        toast.warning('请先生成一致性结果');
        return;
      }

      if (actionId === 'consistency-to-image') {
        spawnControllerToolNode(id as string, 'aiImage', {
          controllerActionId: actionId,
          replaceExisting,
          label: '一致性再生图',
          toastLabel: '一致性再生图',
          sourceHandle: 'output',
          targetHandle: 'input',
          initialData: {
            imageUrl: resultUrl,
            prompt: characterName ? `保持 ${characterName} 角色一致性，生成新的镜头画面` : '保持角色一致性，生成新的镜头画面',
            params: {
              mode: 'image_to_image',
              prompt: characterName ? `保持 ${characterName} 角色一致性，生成新的镜头画面` : '保持角色一致性，生成新的镜头画面',
            },
          },
        });
        return;
      }

      if (actionId === 'consistency-to-video') {
        spawnControllerToolNode(id as string, 'aiVideo', {
          controllerActionId: actionId,
          replaceExisting,
          label: '一致性生视频',
          toastLabel: '一致性生视频',
          sourceHandle: 'output',
          targetHandle: 'input',
          initialData: {
            imageUrl: resultUrl,
            params: {
              generationMode: 'image_to_video',
              startImage: resultUrl,
              prompt: characterName ? `让 ${characterName} 保持角色一致性完成自然动作` : '保持角色一致性完成自然动作',
            },
          },
        });
        return;
      }

      if (actionId === 'consistency-output') {
        spawnControllerToolNode(id as string, 'output', {
          controllerActionId: actionId,
          replaceExisting,
          label: '一致性导出',
          toastLabel: '一致性导出',
          sourceHandle: 'output',
          targetHandle: 'image',
          initialData: {
            receivedImageUrl: resultUrl,
            imageUrl: resultUrl,
            url: resultUrl,
            mediaType: 'image',
          },
        });
      }
    },
    [characterName, id, resultUrl],
  );

  return (
    <div className="relative w-[420px] group border-0 outline-none select-none" style={{ overflow: 'visible' }}>
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="characterConsistency"
        inputId="characterImage"
        extraInputs={['targetImage']}
        inputTip="角色/目标图片"
        outputTip="输出 (一致化图片/角色参考)"
      />

      {/* 节点主体 */}
      <div className={selected ? aicgGlass.videoComposeFrameSelected : aicgGlass.videoComposeFrame}>
        <div className={aicgGlass.videoComposeInnerRing} />
        <AICGNodeShell
          variant="glass-stack"
          aicgType="tool"
        title="角色一致性"
        selected={selected}
        width={420}
        onDelete={handleDelete}
        preview={
        <div className="grid grid-cols-2 gap-2 p-3">
          {/* 角色图片 */}
          <div
            className="relative bg-black flex items-center justify-center overflow-hidden rounded-lg aspect-square"
          >
            {characterImageUrl ? (
              <>
                <img
                  src={getSafeRenderableMediaUrl(characterImageUrl)}
                  alt="Character"
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={() => handleImageChange('character')}
                  className="absolute top-1 right-1 w-6 h-6 rounded bg-black/60 hover:bg-white/20 text-white flex items-center justify-center text-[10px]"
                >
                  <Upload className="w-3 h-3" />
                </button>
              </>
            ) : (
              <div
                className="flex flex-col items-center gap-1 cursor-pointer hover:bg-white/5 transition-colors p-2"
                onClick={() => handleImageChange('character')}
              >
                <Users className="w-6 h-6 text-white/30" />
                <span className="text-[9px] text-white/50">角色图片</span>
              </div>
            )}
          </div>

          {/* 目标图片 */}
          <div
            className="relative bg-black flex items-center justify-center overflow-hidden rounded-lg aspect-square"
          >
            {targetImageUrl ? (
              <>
                <img
                  src={getSafeRenderableMediaUrl(targetImageUrl)}
                  alt="Target"
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={() => handleImageChange('target')}
                  className="absolute top-1 right-1 w-6 h-6 rounded bg-black/60 hover:bg-white/20 text-white flex items-center justify-center text-[10px]"
                >
                  <Upload className="w-3 h-3" />
                </button>
              </>
            ) : (
              <div
                className="flex flex-col items-center gap-1 cursor-pointer hover:bg-white/5 transition-colors p-2"
                onClick={() => handleImageChange('target')}
              >
                <Image className="w-6 h-6 text-white/30" />
                <span className="text-[9px] text-white/50">目标图片</span>
              </div>
            )}
          </div>
        </div>
        }
        controls={
        <div className="flex flex-col gap-3 p-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
            <button
              type="button"
              onClick={() => void handleProcess()}
              disabled={isProcessing || !characterImageUrl}
              className={cn(aicgGlass.actionBtnPrimary, 'h-8 px-3 text-[10px]', (isProcessing || !characterImageUrl) && 'cursor-not-allowed opacity-45')}
            >
              <Wand2 className="h-3.5 w-3.5" />
              一致化
            </button>
            <button type="button" onClick={() => runConsistencyDownstreamAction('consistency-to-image')} disabled={!resultUrl} className={cn(aicgGlass.actionBtn, 'h-8 px-3 text-[10px]', !resultUrl && 'cursor-not-allowed opacity-45')}>
              <Image className="h-3.5 w-3.5" />
              再生图
            </button>
            <button type="button" onClick={() => runConsistencyDownstreamAction('consistency-to-video')} disabled={!resultUrl} className={cn(aicgGlass.actionBtn, 'h-8 px-3 text-[10px]', !resultUrl && 'cursor-not-allowed opacity-45')}>
              转视频
            </button>
            <button type="button" onClick={() => runConsistencyDownstreamAction('consistency-output')} disabled={!resultUrl} className={cn(aicgGlass.actionBtn, 'h-8 px-3 text-[10px]', !resultUrl && 'cursor-not-allowed opacity-45')}>
              导出
            </button>
          </div>
          {/* 角色名称 */}
          <div className="space-y-1">
            <span className="text-[8px] text-white/50 uppercase tracking-wider">角色名称</span>
            <input
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="输入角色名称..."
              className="w-full px-2 py-1.5 bg-black/30 border border-white/10 rounded-lg text-white text-xs placeholder-white/30 focus:outline-none focus:border-white/35 nodrag"
            />
          </div>

          {/* 处理模式 */}
          <div>
            <span className="text-[8px] text-white/50 mb-1 block">处理模式</span>
            <div className="flex gap-1">
              <button
                onClick={() => setProcessingMode('quick')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] transition-all',
                  processingMode === 'quick'
                    ? 'bg-white/[0.08] text-white border border-white/20'
                    : 'bg-white/5 text-white/50 border border-transparent hover:bg-white/10'
                )}
              >
                <Zap className="w-3 h-3" />
                快速
              </button>
              <button
                onClick={() => setProcessingMode('ai')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] transition-all',
                  processingMode === 'ai'
                    ? 'bg-white/[0.08] text-white border border-white/20'
                    : 'bg-white/5 text-white/50 border border-transparent hover:bg-white/10'
                )}
              >
                <Brain className="w-3 h-3" />
                AI
              </button>
            </div>
            {processingMode === 'ai' && (
              <p className="text-[7px] text-white/35 mt-1">调用后端 AI 模型进行角色特征融合</p>
            )}
            {processingMode === 'quick' && (
              <p className="text-[7px] text-white/30 mt-1">本地 Canvas 颜色迁移，速度快但效果有限</p>
            )}
          </div>

          {/* 一致性强度 */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-white/50">一致性强度</span>
              <span className="text-[8px] text-white/60">{Math.round(consistencyStrength * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={consistencyStrength}
              onChange={(e) => setConsistencyStrength(Number(e.target.value))}
              className="w-full h-1 mt-1 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>

          {/* 选项 */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={faceEnhance}
                onChange={(e) => setFaceEnhance(e.target.checked)}
                className="w-3 h-3 rounded accent-white"
              />
              <span className="text-[9px] text-white/70">人脸增强</span>
            </label>
          </div>

          {/* 执行按钮 */}
          <button
            onClick={handleProcess}
            disabled={isProcessing || !characterImageUrl}
            className={cn(
              'w-full py-2.5 rounded-lg font-medium text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2',
              isProcessing || !characterImageUrl
                ? 'bg-white/[0.04] text-white/35 cursor-not-allowed'
                : 'border border-white/20 bg-white/[0.1] text-white hover:border-white/32 hover:bg-white/[0.14] shadow-lg shadow-black/20'
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                保持角色一致性
              </>
            )}
          </button>

          {/* 下载按钮 */}
          {resultUrl && (
            <button
              onClick={handleDownload}
              className="w-full py-2 rounded-lg bg-black/40 hover:bg-black/60 text-white text-[10px] font-medium transition-all flex items-center justify-center gap-2 border border-white/10 hover:border-white/20"
            >
              <Download className="w-3.5 h-3.5" />
              下载结果
            </button>
          )}
        </div>
        }
      />
      </div>
    </div>
  );
});

CharacterConsistencyNode.displayName = 'CharacterConsistencyNode';

export default CharacterConsistencyNode;
