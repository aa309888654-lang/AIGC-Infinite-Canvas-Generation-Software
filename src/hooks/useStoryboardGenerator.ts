import { useCallback, useRef, useReducer } from 'react';
import { toast } from 'sonner';
import { backendProxyAdapter } from '@/services/adapters/backend-proxy-adapter';
import { getAuthToken, safeRefreshMembership } from '@/lib/auth-check';
import { canvasStoreApi } from '@/store/useCanvasStore';

interface StoryboardState {
  isExecuting: boolean;
  localResult: string;
  localError: string;
  localExecTime: number;
  generatedImages: string[];
  characterLockImageUrl: string;
  gridGenProgress: { current: number; total: number };
  failedIndices: number[];
  previewImageUrl: string | null;
}

type StoryboardAction =
  | { type: 'SET_EXECUTING'; payload: boolean }
  | { type: 'SET_RESULT'; payload: string }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_EXEC_TIME'; payload: number }
  | { type: 'SET_GENERATED_IMAGES'; payload: string[] }
  | { type: 'UPDATE_IMAGE'; payload: { index: number; url: string } }
  | { type: 'SET_CHARACTER_LOCK'; payload: string }
  | { type: 'SET_PROGRESS'; payload: { current: number; total: number } }
  | { type: 'SET_FAILED_INDICES'; payload: number[] }
  | { type: 'SET_PREVIEW_IMAGE'; payload: string | null }
  | { type: 'RESET' };

const initialState: StoryboardState = {
  isExecuting: false,
  localResult: '',
  localError: '',
  localExecTime: 0,
  generatedImages: [],
  characterLockImageUrl: '',
  gridGenProgress: { current: 0, total: 0 },
  failedIndices: [],
  previewImageUrl: null,
};

function storyboardReducer(state: StoryboardState, action: StoryboardAction): StoryboardState {
  switch (action.type) {
    case 'SET_EXECUTING':
      return { ...state, isExecuting: action.payload };
    case 'SET_RESULT':
      return { ...state, localResult: action.payload };
    case 'SET_ERROR':
      return { ...state, localError: action.payload };
    case 'SET_EXEC_TIME':
      return { ...state, localExecTime: action.payload };
    case 'SET_GENERATED_IMAGES':
      return { ...state, generatedImages: action.payload };
    case 'UPDATE_IMAGE': {
      const newImages = [...state.generatedImages];
      newImages[action.payload.index] = action.payload.url;
      return { ...state, generatedImages: newImages };
    }
    case 'SET_CHARACTER_LOCK':
      return { ...state, characterLockImageUrl: action.payload };
    case 'SET_PROGRESS':
      return { ...state, gridGenProgress: action.payload };
    case 'SET_FAILED_INDICES':
      return { ...state, failedIndices: action.payload };
    case 'SET_PREVIEW_IMAGE':
      return { ...state, previewImageUrl: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const POLL_INTERVAL = 3000;
const MAX_POLL_ATTEMPTS = 60;

const normalizeReferenceImageUrl = async (imageUrl?: string): Promise<string> => {
  if (!imageUrl) return '';
  if (!imageUrl.startsWith('blob:')) return imageUrl;
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn('[StoryboardGenerator] normalizeRefImage: blob URL expired');
      return '';
    }
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Reference image conversion failed'));
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('[StoryboardGenerator] normalizeRefImage failed:', err);
    return '';
  }
};

export function useStoryboardGenerator(nodeId: string) {
  const [state, dispatch] = useReducer(storyboardReducer, initialState);
  const abortRef = useRef(false);

  // Request a single image with polling
  const requestGeneratedImage = useCallback(async (imageParams: Record<string, unknown>): Promise<string> => {
    const result = await backendProxyAdapter.generateImage(imageParams as never);

    // Check for abort after the initial generation request returns
    if (abortRef.current) throw new Error('已取消生成');

    if (result.success && result.taskId && (result.status === 'pending' || result.status === 'processing')) {
      for (let poll = 0; poll < MAX_POLL_ATTEMPTS; poll++) {
        if (abortRef.current) throw new Error('已取消生成');
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        const status = await backendProxyAdapter.getTaskStatus({ taskId: result.taskId });
        if (abortRef.current) throw new Error('已取消生成');
        if (status.status === 'completed') {
          return status.resultUrl || (typeof status.output === 'string' ? status.output : '') || '';
        } else if (status.status === 'failed') {
          throw new Error(status.error || '图片生成失败');
        }
      }
      throw new Error('图片生成超时，请稍后重试');
    }

    const imageUrlResult = result.resultUrl || result.output || result.url;
    if (!result.success || !imageUrlResult) {
      throw new Error(result.error || '图片生成失败');
    }

    return imageUrlResult;
  }, []);

  // Generate grid prompts only
  const generateGrid = useCallback((
    params: Record<string, unknown>,
    panelCount: number,
    gridStyle: string,
    storyTemplate: string,
    customScenes: string[],
    extraPrompt: string,
    shotTemplate: string,
    sceneConfigs: Record<string, unknown>[],
    generateGridPromptsFn: (...args: unknown[]) => string[]
  ) => {
    dispatch({ type: 'SET_EXECUTING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: '' });
    const startTime = performance.now();

    try {
      const characterLockImageUrl = state.characterLockImageUrl || (params.imageUrl as string) || '';
      const prompts = generateGridPromptsFn(
        characterLockImageUrl, panelCount, gridStyle, storyTemplate,
        customScenes, extraPrompt, shotTemplate, sceneConfigs
      );
      const resultStr = JSON.stringify(prompts, null, 2);
      const execTime = performance.now() - startTime;

      dispatch({ type: 'SET_RESULT', payload: resultStr });
      dispatch({ type: 'SET_EXEC_TIME', payload: Math.round(execTime * 100) / 100 });

      canvasStoreApi.updateNodeData(nodeId, {
        lastResult: resultStr,
        lastError: '',
        executionTime: execTime,
        generatedPrompts: prompts,
        params: { ...params, panelCount, gridStyle, storyTemplate, customScenes, sceneConfigs, extraPrompt, shotTemplate },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      dispatch({ type: 'SET_ERROR', payload: errorMsg });
      canvasStoreApi.updateNodeData(nodeId, { lastError: errorMsg });
    } finally {
      dispatch({ type: 'SET_EXECUTING', payload: false });
    }
  }, [nodeId, state.characterLockImageUrl]);

  // Generate grid images (single or batch)
  const generateGridImages = useCallback(async (
    mode: 'single' | 'batch',
    rawReferenceImage: string,
    characterLockSourceUrl: string | undefined,
    config: {
      panelCount: number;
      gridStyle: string;
      storyTemplate: string;
      customScenes: string[];
      extraPrompt: string;
      shotTemplate: string;
      sceneConfigs: Record<string, unknown>[];
      imageModel: string;
      storyboardRatio: string;
    },
    params: Record<string, unknown>,
    imageModels: Array<{ value: string; provider: string; label: string }>,
    generateGridPromptsFn: (...args: unknown[]) => string[],
    buildCharacterLockPromptFn: (style: string, extra: string) => string
  ) => {
    dispatch({ type: 'SET_EXECUTING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: '' });
    abortRef.current = false;

    const token = getAuthToken();
    if (token) backendProxyAdapter.setToken(token);

    // Normalize the reference image (handle blob URLs)
    const normalizedReferenceImage = await normalizeReferenceImageUrl(rawReferenceImage);
    let storyboardReferenceImage = state.characterLockImageUrl;

    // Validate that we have at least one reference image
    if (!storyboardReferenceImage && !normalizedReferenceImage) {
      toast.warning('必须先绑定参考图才能生成分镜', {
        description: '请从图片节点拖线连接或上传参考图',
      });
      dispatch({ type: 'SET_EXECUTING', payload: false });
      return;
    }

    // Determine if we need to generate a character lock
    const requiresCharacterLock = Boolean(normalizedReferenceImage) && (
      !storyboardReferenceImage || characterLockSourceUrl !== rawReferenceImage
    );

    const modelConfig = imageModels.find((m) => m.value === config.imageModel) || imageModels[0];

    // Generate character lock if needed
    if (requiresCharacterLock) {
      dispatch({ type: 'SET_RESULT', payload: '正在根据参考图生成角色定妆锁定图...' });
      const characterLockPrompt = buildCharacterLockPromptFn(config.gridStyle, config.extraPrompt);
      const characterLockNegativePrompt = '不同的人，不同的脸，面容改变，发型改变，发色改变，服装改变，配饰改变，体型改变，多人，重复人物，面部模糊，无关身份';
      const useGptImageForRef = modelConfig.provider === 'doubao';

      try {
        const generatedCharacterLockImage = await requestGeneratedImage({
          prompt: characterLockPrompt,
          negativePrompt: characterLockNegativePrompt,
          aspectRatio: '3:4',
          modelProvider: useGptImageForRef ? 'doubao' : modelConfig.provider,
          modelId: useGptImageForRef ? 'doubao-seedream-5-0-pro' : modelConfig.value,
          referenceImage: normalizedReferenceImage,
          referenceImages: [normalizedReferenceImage],
          generationMode: 'character_reference',
          characterConsistency: 1,
          imageCount: 1,
        });
        storyboardReferenceImage = generatedCharacterLockImage;
        dispatch({ type: 'SET_CHARACTER_LOCK', payload: generatedCharacterLockImage });
        canvasStoreApi.updateNodeData(nodeId, {
          characterLockImageUrl: generatedCharacterLockImage,
          characterLockSourceUrl: rawReferenceImage,
          lastError: '',
        });
      } catch (err) {
        dispatch({ type: 'SET_ERROR', payload: '定妆图生成失败: ' + (err instanceof Error ? err.message : String(err)) });
        dispatch({ type: 'SET_EXECUTING', payload: false });
        return;
      }
    } else {
      storyboardReferenceImage = storyboardReferenceImage || normalizedReferenceImage;
    }

    // Generate prompts
    const prompts = generateGridPromptsFn(
      storyboardReferenceImage, config.panelCount, config.gridStyle, config.storyTemplate,
      config.customScenes, config.extraPrompt, config.shotTemplate, config.sceneConfigs
    );

    const startIdx = state.generatedImages.filter(Boolean).length;
    if (startIdx >= prompts.length && mode === 'single') {
      dispatch({ type: 'SET_EXECUTING', payload: false });
      toast.info('当前分镜已全部生成完成');
      return;
    }

    const resultStr = JSON.stringify(prompts, null, 2);
    dispatch({ type: 'SET_RESULT', payload: resultStr });
    canvasStoreApi.updateNodeData(nodeId, {
      lastResult: resultStr,
      lastError: '',
      generatedPrompts: prompts,
      params: { ...params, panelCount: config.panelCount, gridStyle: config.gridStyle, storyTemplate: config.storyTemplate, customScenes: config.customScenes, sceneConfigs: config.sceneConfigs, extraPrompt: config.extraPrompt, shotTemplate: config.shotTemplate, imageModel: config.imageModel, storyboardRatio: config.storyboardRatio },
    });

    const newImages = Array.from({ length: prompts.length }, (_, idx) => state.generatedImages[idx] ?? '');
    const localFailures: number[] = [];
    const generationIndices = mode === 'single'
      ? [startIdx]
      : Array.from({ length: prompts.length - startIdx }, (_, idx) => startIdx + idx);
    const totalSteps = generationIndices.length + (requiresCharacterLock ? 1 : 0);
    dispatch({ type: 'SET_PROGRESS', payload: { current: requiresCharacterLock ? 1 : 0, total: totalSteps } });

    for (let step = 0; step < generationIndices.length; step++) {
      const i = generationIndices[step];
      if (abortRef.current) break;

      dispatch({ type: 'SET_PROGRESS', payload: { current: (requiresCharacterLock ? 1 : 0) + step + 1, total: totalSteps } });

      try {
        const effectiveRef = storyboardReferenceImage || normalizedReferenceImage || '';
        const useGptImageForRef = modelConfig.provider === 'doubao';
        const negativePrompt = '不同的人，不同的脸，身份偏移，面容改变，发型改变，发色改变，服装改变，配饰替换，性别改变，年龄改变，体型改变，环境改变，背景改变，衣服更换，多人，重复人物，错误身份';
        const imageParams = {
          prompt: prompts[i],
          negativePrompt,
          aspectRatio: config.storyboardRatio,
          modelProvider: useGptImageForRef ? 'doubao' : modelConfig.provider,
          modelId: useGptImageForRef ? 'doubao-seedream-5-0-pro' : modelConfig.value,
          referenceImage: effectiveRef,
          referenceImages: [effectiveRef],
          generationMode: 'character_reference' as const,
          characterConsistency: 1,
          imageCount: 1,
        };

        const imageUrlResult = await requestGeneratedImage(imageParams);
        newImages[i] = imageUrlResult;
        dispatch({ type: 'SET_GENERATED_IMAGES', payload: [...newImages] });
        canvasStoreApi.updateNodeData(nodeId, { generatedImages: [...newImages], lastError: '' });
      } catch {
        if (mode === 'single') {
          dispatch({ type: 'SET_ERROR', payload: `第 ${i + 1} 张分镜生成失败` });
          canvasStoreApi.updateNodeData(nodeId, { lastError: `第 ${i + 1} 张分镜生成失败` });
          break;
        }
        newImages[i] = `[第${i + 1}格生成失败]`;
        localFailures.push(i);
        dispatch({ type: 'SET_GENERATED_IMAGES', payload: [...newImages] });
      }
    }

    const validResults = newImages.filter((img) => img && !img.startsWith('[第'));
    if (validResults.length === 0 && localFailures.length === 0) {
      dispatch({ type: 'SET_ERROR', payload: '所有图片生成失败' });
      canvasStoreApi.updateNodeData(nodeId, { lastError: '所有图片生成失败' });
    } else if (localFailures.length > 0) {
      const failedMsg = localFailures.map((idx) => `第${idx + 1}格`).join('、') + ' 生成失败';
      dispatch({ type: 'SET_ERROR', payload: failedMsg });
      canvasStoreApi.updateNodeData(nodeId, { lastError: failedMsg });
    }

    dispatch({ type: 'SET_FAILED_INDICES', payload: localFailures });
    safeRefreshMembership();
    dispatch({ type: 'SET_EXECUTING', payload: false });
    dispatch({ type: 'SET_PROGRESS', payload: { current: 0, total: 0 } });
  }, [nodeId, state.characterLockImageUrl, state.generatedImages, requestGeneratedImage]);

  // Abort generation
  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  // Reset state
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Reset character lock only
  const resetCharacterLock = useCallback(() => {
    dispatch({ type: 'SET_CHARACTER_LOCK', payload: '' });
    dispatch({ type: 'SET_GENERATED_IMAGES', payload: [] });
    dispatch({ type: 'SET_ERROR', payload: '' });
    canvasStoreApi.updateNodeData(nodeId, {
      characterLockImageUrl: undefined,
      characterLockSourceUrl: undefined,
      generatedImages: [],
      lastError: '',
    });
  }, [nodeId]);

  // Clear all images
  const clearAllImages = useCallback(() => {
    dispatch({ type: 'SET_GENERATED_IMAGES', payload: [] });
    dispatch({ type: 'SET_CHARACTER_LOCK', payload: '' });
    dispatch({ type: 'SET_ERROR', payload: '' });
    dispatch({ type: 'SET_RESULT', payload: '' });
    canvasStoreApi.updateNodeData(nodeId, {
      characterLockImageUrl: undefined,
      characterLockSourceUrl: undefined,
      generatedImages: [],
      lastResult: '',
      lastError: '',
    });
  }, [nodeId]);

  // Initialize state from node data (for restoring from saved state)
  const initFromNodeData = useCallback((nodeData: {
    generatedImages?: string[];
    characterLockImageUrl?: string;
    lastResult?: string;
    lastError?: string;
    executionTime?: number;
  }) => {
    if (nodeData.generatedImages) dispatch({ type: 'SET_GENERATED_IMAGES', payload: nodeData.generatedImages });
    if (nodeData.characterLockImageUrl) dispatch({ type: 'SET_CHARACTER_LOCK', payload: nodeData.characterLockImageUrl });
    if (nodeData.lastResult) dispatch({ type: 'SET_RESULT', payload: nodeData.lastResult });
    if (nodeData.lastError) dispatch({ type: 'SET_ERROR', payload: nodeData.lastError });
    if (nodeData.executionTime) dispatch({ type: 'SET_EXEC_TIME', payload: nodeData.executionTime });
  }, []);

  return {
    state,
    dispatch,
    generateGrid,
    generateGridImages,
    abort,
    reset,
    resetCharacterLock,
    clearAllImages,
    initFromNodeData,
  };
}
